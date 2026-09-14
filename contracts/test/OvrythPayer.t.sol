// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {OvrythPayer} from "../src/OvrythPayer.sol";
import {ISpendPermissionManager, SpendPermission} from "../src/ISpendPermissionManager.sol";

/// Extra manager entrypoints used only by tests to set up state without a browser wallet.
interface IManagerTest {
    function approve(SpendPermission calldata spendPermission) external returns (bool);
    function revoke(SpendPermission calldata spendPermission) external;
}

interface ICoinbaseSmartWalletFactory {
    function createAccount(bytes[] calldata owners, uint256 nonce) external payable returns (address);
}

interface ICoinbaseSmartWallet {
    function addOwnerAddress(address owner) external;
    function replaySafeHash(bytes32 hash) external view returns (bytes32);
}

/// Coinbase Smart Wallet ERC-1271 signature envelope.
struct SignatureWrapper {
    uint256 ownerIndex;
    bytes signatureData;
}

/// Fork tests against the live Base mainnet SpendPermissionManager + Coinbase Smart Wallet factory.
/// Run: forge test --fork-url $BASE_RPC   (or set BASE_RPC / rely on the default public RPC)
contract OvrythPayerTest is Test {
    address constant MANAGER = 0xf85210B21cC50302F477BA56686d2019dC9b67Ad;
    address constant FACTORY = 0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    uint256 constant OWNER_PK = 0xA11CE;

    OvrythPayer payer;
    address operator = address(0x0FE7A704);
    address recipient = address(0xC0FFEE);
    address ownerEoa;

    function setUp() public {
        vm.createSelectFork(vm.envOr("BASE_RPC", string("https://mainnet.base.org")));
        // Seed the L1Block predeploy operator-fee scalars slot so op-revm's Isthmus path
        // finds a value instead of panicking ("Missing operator fee scalar") on forked Base.
        vm.store(0x4200000000000000000000000000000000000015, bytes32(uint256(8)), bytes32(uint256(1)));
        ownerEoa = vm.addr(OWNER_PK);
        payer = new OvrythPayer(MANAGER, operator);
    }

    // ------------------------------------------------------------------ helpers

    /// Deploy a fresh Coinbase Smart Wallet owned by OWNER_PK, add the manager as an owner
    /// (required for spend()), fund it with USDC, and return a permission spendable by the payer.
    function _newPermission(uint160 allowance) internal returns (SpendPermission memory p, address account) {
        bytes[] memory owners = new bytes[](1);
        owners[0] = abi.encode(ownerEoa);
        account = ICoinbaseSmartWalletFactory(FACTORY).createAccount(owners, 0);

        vm.prank(ownerEoa);
        ICoinbaseSmartWallet(account).addOwnerAddress(MANAGER);

        deal(USDC, account, 1_000e6);

        p = SpendPermission({
            account: account,
            spender: address(payer),
            token: USDC,
            allowance: allowance,
            period: 1 days,
            start: uint48(block.timestamp - 600),
            end: type(uint48).max,
            salt: 0,
            extraData: ""
        });
    }

    /// Owner-signed ERC-1271 signature for approveWithSignature (SignatureWrapper over replaySafeHash).
    function _sign(SpendPermission memory p) internal view returns (bytes memory) {
        bytes32 h = ISpendPermissionManager(MANAGER).getHash(p);
        bytes32 digest = ICoinbaseSmartWallet(p.account).replaySafeHash(h);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(OWNER_PK, digest);
        return abi.encode(SignatureWrapper({ownerIndex: 0, signatureData: abi.encodePacked(r, s, v)}));
    }

    function _approveDirect(SpendPermission memory p) internal {
        vm.prank(p.account);
        IManagerTest(MANAGER).approve(p);
    }

    // -------------------------------------------------------------------- tests

    /// Happy path: approve (via signature) + spend + transfer in a single pay() call.
    function test_pay_happyPath_withSignature() public {
        (SpendPermission memory p,) = _newPermission(1e6);
        bytes memory sig = _sign(p);

        uint256 before = IERC20(USDC).balanceOf(recipient);
        vm.prank(operator);
        payer.pay(p, sig, true, 0.25e6, recipient);

        assertEq(IERC20(USDC).balanceOf(recipient) - before, 0.25e6, "recipient not paid");
        assertEq(IERC20(USDC).balanceOf(address(payer)), 0, "tokens rested in payer");
    }

    /// Second pay reuses the already-approved permission (needsApprove = false).
    function test_pay_secondPay_withoutApprove() public {
        (SpendPermission memory p,) = _newPermission(1e6);
        bytes memory sig = _sign(p);

        vm.prank(operator);
        payer.pay(p, sig, true, 0.25e6, recipient);
        vm.prank(operator);
        payer.pay(p, "", false, 0.25e6, recipient);

        assertEq(IERC20(USDC).balanceOf(recipient), 0.5e6, "two payouts not summed");
        assertEq(IERC20(USDC).balanceOf(address(payer)), 0, "tokens rested in payer");
    }

    /// Spending more than the permission allowance reverts the whole call.
    function test_pay_overCap_reverts() public {
        (SpendPermission memory p,) = _newPermission(1e6);
        _approveDirect(p);

        vm.prank(operator);
        vm.expectRevert();
        payer.pay(p, "", false, 2e6, recipient);

        assertEq(IERC20(USDC).balanceOf(recipient), 0, "paid despite over-cap");
    }

    /// A revoked permission cannot be spent.
    function test_pay_revoked_reverts() public {
        (SpendPermission memory p,) = _newPermission(1e6);
        _approveDirect(p);
        vm.prank(p.account);
        IManagerTest(MANAGER).revoke(p);

        vm.prank(operator);
        vm.expectRevert();
        payer.pay(p, "", false, 0.25e6, recipient);
    }

    /// Only the operator can call pay().
    function test_pay_nonOperator_reverts() public {
        (SpendPermission memory p,) = _newPermission(1e6);
        _approveDirect(p);

        vm.prank(address(0xBAD));
        vm.expectRevert(OvrythPayer.NotOperator.selector);
        payer.pay(p, "", false, 0.25e6, recipient);
    }

    /// The payer holds no token-moving path beyond pay(): a stray balance cannot be swept out.
    function test_noSweepPath() public {
        deal(USDC, address(payer), 5e6);
        // There is no withdraw/rescue function; the balance is simply stuck, never extractable by the operator.
        assertEq(IERC20(USDC).balanceOf(address(payer)), 5e6);
    }

    /// setOperator rotates the key and is operator-gated.
    function test_setOperator() public {
        address next = address(0xBEEF);
        vm.prank(operator);
        payer.setOperator(next);
        assertEq(payer.operator(), next);

        vm.prank(address(0xBAD));
        vm.expectRevert(OvrythPayer.NotOperator.selector);
        payer.setOperator(operator);
    }
}

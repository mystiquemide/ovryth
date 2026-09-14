// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {ISpendPermissionManager, SpendPermission} from "./ISpendPermissionManager.sol";

/// @title OvrythPayer
/// @notice The sole spender named in every Ovryth spend permission. A single `pay()`
///         call approves the permission (first time only), pulls the exact amount from
///         the project's Base Account via the SpendPermissionManager, and forwards it to
///         the contributor, all in one transaction.
/// @dev Custody guarantee: this contract has no withdraw path, no arbitrary call, and no
///      way to receive ETH. Tokens only ever pass through during `pay()`; nothing can rest
///      here and the operator can never move more than a permission's on-chain cap allows.
contract OvrythPayer {
    using SafeERC20 for IERC20;

    /// @notice The SpendPermissionManager singleton this payer spends through.
    address public immutable manager;

    /// @notice The Ovryth operator key allowed to trigger payouts.
    address public operator;

    /// @notice Emitted on every successful payout.
    event Paid(bytes32 indexed permissionHash, address indexed recipient, uint160 amount);

    /// @notice Emitted when the operator key is rotated.
    event OperatorChanged(address indexed previousOperator, address indexed newOperator);

    error NotOperator();
    error ZeroAddress();
    error ApproveFailed();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(address manager_, address operator_) {
        if (manager_ == address(0) || operator_ == address(0)) revert ZeroAddress();
        manager = manager_;
        operator = operator_;
        emit OperatorChanged(address(0), operator_);
    }

    /// @notice Approve (if needed), spend within the permission's cap, and forward to the contributor.
    /// @param p           The spend permission whose `spender` must be this contract.
    /// @param approveSig  Owner signature over `p`; only used when `needsApprove` is true.
    /// @param needsApprove True on the first payout for a permission (not yet approved onchain).
    /// @param amount      Exact amount to spend and forward (already clamped by the policy layer).
    /// @param recipient   The contributor's linked wallet (never derived from message text).
    function pay(
        SpendPermission calldata p,
        bytes calldata approveSig,
        bool needsApprove,
        uint160 amount,
        address recipient
    ) external onlyOperator {
        if (recipient == address(0)) revert ZeroAddress();

        bytes32 permissionHash = ISpendPermissionManager(manager).getHash(p);

        if (needsApprove) {
            bool approved = ISpendPermissionManager(manager).approveWithSignature(p, approveSig);
            if (!approved) revert ApproveFailed();
        }
        // Pull tokens from the project's account into this contract, capped by the permission.
        ISpendPermissionManager(manager).spend(p, amount);
        // Forward the exact amount to the contributor in the same transaction.
        IERC20(p.token).safeTransfer(recipient, amount);

        emit Paid(permissionHash, recipient, amount);
    }

    /// @notice Rotate the operator key. The only other state-changing function besides `pay()`.
    function setOperator(address newOperator) external onlyOperator {
        if (newOperator == address(0)) revert ZeroAddress();
        address previousOperator = operator;
        operator = newOperator;
        emit OperatorChanged(previousOperator, newOperator);
    }
}

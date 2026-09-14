// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OvrythPayer} from "../src/OvrythPayer.sol";

/// @notice Deploys OvrythPayer to Base mainnet from the operator key.
///         The deployer key is also set as the initial operator.
///
/// Run:
///   forge script script/Deploy.s.sol \
///     --rpc-url "$BASE_RPC_URL" \
///     --private-key "$OVRYTH_OPERATOR_PRIVATE_KEY" \
///     --broadcast --verify --verifier etherscan \
///     --etherscan-api-key "$ETHERSCAN_API_KEY"
contract Deploy is Script {
    address constant MANAGER = 0xf85210B21cC50302F477BA56686d2019dC9b67Ad; // SpendPermissionManager (Base)

    function run() external returns (OvrythPayer payer) {
        uint256 pk = vm.envUint("OVRYTH_OPERATOR_PRIVATE_KEY");
        address operator = vm.addr(pk);

        vm.startBroadcast(pk);
        payer = new OvrythPayer(MANAGER, operator);
        vm.stopBroadcast();

        console2.log("OvrythPayer deployed:", address(payer));
        console2.log("manager:", payer.manager());
        console2.log("operator:", payer.operator());
    }
}

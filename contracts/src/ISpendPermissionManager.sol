// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Spend permission struct, copied verbatim from coinbase/spend-permissions
///         (SpendPermissionManager.SpendPermission) at the version deployed on Base
///         mainnet at 0xf85210B21cC50302F477BA56686d2019dC9b67Ad.
struct SpendPermission {
    /// @dev Smart account this spend permission is valid for.
    address account;
    /// @dev Entity that can spend `account`'s tokens (the OvrythPayer contract).
    address spender;
    /// @dev Token address (ERC-7528 native token or ERC-20 contract).
    address token;
    /// @dev Maximum allowed value to spend within each `period`.
    uint160 allowance;
    /// @dev Time duration for resetting used `allowance` on a recurring basis (seconds).
    uint48 period;
    /// @dev Timestamp this permission is valid after (unix seconds).
    uint48 start;
    /// @dev Timestamp this permission is valid until (unix seconds).
    uint48 end;
    /// @dev An arbitrary salt to differentiate unique spend permissions with otherwise identical fields.
    uint256 salt;
    /// @dev Arbitrary data to include in the permission.
    bytes extraData;
}

/// @notice Minimal interface to the deployed SpendPermissionManager singleton.
interface ISpendPermissionManager {
    /// @notice Approve a spend permission via a signature from the account owner.
    function approveWithSignature(SpendPermission calldata spendPermission, bytes calldata signature)
        external
        returns (bool);

    /// @notice Spend tokens using a spend permission; must be called by `spendPermission.spender`.
    ///         Transfers `value` of the permission's token from the account to the spender.
    function spend(SpendPermission calldata spendPermission, uint160 value) external;

    /// @notice EIP-712 hash of a spend permission, used as its onchain identifier.
    function getHash(SpendPermission calldata spendPermission) external view returns (bytes32);
}

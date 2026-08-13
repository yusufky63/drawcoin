// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DrawCoinMissionBadges} from "../DrawCoinMissionBadges.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function expectPartialRevert(bytes4 revertData) external;
    function expectRevert(bytes4 revertData) external;
    function prank(address caller) external;
    function sign(uint256 privateKey, bytes32 digest)
        external
        returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 timestamp) external;
}

contract DrawCoinMissionBadgesTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant SIGNER_PRIVATE_KEY = 0xA11CE;
    address private signer;
    address private user;
    DrawCoinMissionBadges private badges;

    function setUp() public {
        signer = vm.addr(SIGNER_PRIVATE_KEY);
        user = vm.addr(0xB0B);
        badges = new DrawCoinMissionBadges(address(this), signer, "ipfs://drawcoin-badges/");
    }

    function testClaimsValidVoucherOnce() public {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory signature = _sign(user, 1, 0, deadline);

        vm.prank(user);
        badges.claim(1, 0, deadline, signature);

        require(badges.balanceOf(user, 1) == 1, "badge was not minted");
        require(badges.claimed(user, 1), "claim flag was not set");
        require(badges.nonces(user) == 1, "nonce was not incremented");

        vm.expectPartialRevert(DrawCoinMissionBadges.AlreadyClaimed.selector);
        vm.prank(user);
        badges.claim(1, 1, deadline, signature);
    }

    function testRejectsExpiredVoucher() public {
        uint256 deadline = block.timestamp + 1;
        bytes memory signature = _sign(user, 2, 0, deadline);
        vm.warp(deadline + 1);

        vm.expectPartialRevert(DrawCoinMissionBadges.ExpiredVoucher.selector);
        vm.prank(user);
        badges.claim(2, 0, deadline, signature);
    }

    function testBadgesCannotBeTransferred() public {
        vm.expectRevert(DrawCoinMissionBadges.Soulbound.selector);
        vm.prank(user);
        badges.safeTransferFrom(user, address(0xCAFE), 1, 1, "");
    }

    function testVoucherIsBoundToWallet() public {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory signature = _sign(user, 1, 0, deadline);

        vm.expectPartialRevert(DrawCoinMissionBadges.InvalidSigner.selector);
        vm.prank(vm.addr(0xBAD));
        badges.claim(1, 0, deadline, signature);
    }

    function testNonceCannotBeReusedForAnotherBadge() public {
        uint256 deadline = block.timestamp + 10 minutes;
        bytes memory firstSignature = _sign(user, 1, 0, deadline);
        bytes memory staleSignature = _sign(user, 2, 0, deadline);

        vm.prank(user);
        badges.claim(1, 0, deadline, firstSignature);

        vm.expectPartialRevert(DrawCoinMissionBadges.InvalidNonce.selector);
        vm.prank(user);
        badges.claim(2, 0, deadline, staleSignature);
    }

    function _sign(address account, uint256 tokenId, uint256 nonce, uint256 deadline)
        private
        returns (bytes memory)
    {
        DrawCoinMissionBadges.Claim memory voucher = DrawCoinMissionBadges.Claim({
            account: account, tokenId: tokenId, nonce: nonce, deadline: deadline
        });
        bytes32 digest = badges.hashClaim(voucher);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PRIVATE_KEY, digest);
        return abi.encodePacked(r, s, v);
    }
}

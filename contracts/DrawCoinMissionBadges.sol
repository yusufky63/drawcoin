// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DrawCoin Mission Badges
/// @notice Non-transferable ERC-1155 badges claimed with short-lived EIP-712 vouchers.
/// @dev This contract is dependency-free so the exact source can be verified as deployed.
contract DrawCoinMissionBadges {
    struct Claim {
        address account;
        uint256 tokenId;
        uint256 nonce;
        uint256 deadline;
    }

    error AlreadyClaimed(address account, uint256 tokenId);
    error ExpiredVoucher(uint256 deadline);
    error ArrayLengthMismatch();
    error InvalidNonce(uint256 expected, uint256 received);
    error InvalidOwner(address caller);
    error InvalidSigner(address recovered);
    error InvalidSignature();
    error InvalidTokenId();
    error Soulbound();
    error UnsafeRecipient(address recipient);
    error ZeroAddress();

    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event BadgeClaimed(address indexed account, uint256 indexed tokenId, uint256 nonce);
    event BaseURIUpdated(string newBaseURI);
    event ClaimSignerUpdated(address indexed previousSigner, address indexed newSigner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TransferBatch(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] values
    );
    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );
    event URI(string value, uint256 indexed id);

    string public constant name = "DrawCoin Mission Badges";
    string public constant symbol = "DRAWBADGE";

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address account,uint256 tokenId,uint256 nonce,uint256 deadline)");
    bytes32 private constant _DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant _NAME_HASH = keccak256("DrawCoin Mission Badges");
    bytes32 private constant _VERSION_HASH = keccak256("1");
    uint256 private constant _SECP256K1_HALF_ORDER =
        0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    address public owner;
    address public pendingOwner;
    address public claimSigner;

    mapping(address account => mapping(uint256 tokenId => uint256 amount)) private _balances;
    mapping(uint256 tokenId => uint256 amount) public totalSupply;
    mapping(address account => mapping(uint256 tokenId => bool wasClaimed)) public claimed;
    mapping(address account => uint256 nextNonce) public nonces;

    string private _baseTokenURI;
    uint256 private immutable _deploymentChainId;
    bytes32 private immutable _deploymentDomainSeparator;

    modifier onlyOwner() {
        if (msg.sender != owner) revert InvalidOwner(msg.sender);
        _;
    }

    constructor(address initialOwner, address initialClaimSigner, string memory initialBaseURI) {
        if (initialOwner == address(0) || initialClaimSigner == address(0)) revert ZeroAddress();

        owner = initialOwner;
        claimSigner = initialClaimSigner;
        _baseTokenURI = initialBaseURI;
        _deploymentChainId = block.chainid;
        _deploymentDomainSeparator = _buildDomainSeparator();

        emit OwnershipTransferred(address(0), initialOwner);
        emit ClaimSignerUpdated(address(0), initialClaimSigner);
        emit BaseURIUpdated(initialBaseURI);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0xd9b67a26 // ERC-1155
            || interfaceId == 0x0e89341c; // ERC-1155 metadata URI
    }

    function balanceOf(address account, uint256 tokenId) public view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balances[account][tokenId];
    }

    function balanceOfBatch(address[] calldata accounts, uint256[] calldata tokenIds)
        external
        view
        returns (uint256[] memory balances)
    {
        if (accounts.length != tokenIds.length) revert ArrayLengthMismatch();

        balances = new uint256[](accounts.length);
        for (uint256 index; index < accounts.length; ++index) {
            balances[index] = balanceOf(accounts[index], tokenIds[index]);
        }
    }

    function uri(uint256 tokenId) external view returns (string memory) {
        return string.concat(_baseTokenURI, _toString(tokenId), ".json");
    }

    /// @notice Claims a badge for the calling wallet. Each wallet and token ID can be claimed once.
    /// @param tokenId Mission badge token ID.
    /// @param nonce Current value returned by `nonces(msg.sender)`.
    /// @param deadline Unix timestamp after which the voucher is invalid.
    /// @param signature EIP-712 signature from `claimSigner` over the claim fields.
    function claim(uint256 tokenId, uint256 nonce, uint256 deadline, bytes calldata signature)
        external
    {
        if (tokenId == 0) revert InvalidTokenId();
        if (block.timestamp > deadline) revert ExpiredVoucher(deadline);
        if (claimed[msg.sender][tokenId]) revert AlreadyClaimed(msg.sender, tokenId);

        uint256 expectedNonce = nonces[msg.sender];
        if (nonce != expectedNonce) revert InvalidNonce(expectedNonce, nonce);

        Claim memory voucher =
            Claim({account: msg.sender, tokenId: tokenId, nonce: nonce, deadline: deadline});
        address recovered = _recover(_hashTypedData(_hashClaim(voucher)), signature);
        if (recovered != claimSigner) revert InvalidSigner(recovered);

        // Effects are committed before the optional ERC-1155 receiver callback.
        nonces[msg.sender] = expectedNonce + 1;
        claimed[msg.sender][tokenId] = true;
        _balances[msg.sender][tokenId] = 1;
        totalSupply[tokenId] += 1;

        emit TransferSingle(msg.sender, address(0), msg.sender, tokenId, 1);
        emit BadgeClaimed(msg.sender, tokenId, nonce);

        _checkERC1155Received(msg.sender, tokenId);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparator();
    }

    function hashClaim(Claim calldata voucher) external view returns (bytes32) {
        return _hashTypedData(_hashClaim(voucher));
    }

    function safeTransferFrom(address, address, uint256, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function setClaimSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();

        address previousSigner = claimSigner;
        claimSigner = newSigner;
        emit ClaimSignerUpdated(previousSigner, newSigner);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function startOwnershipTransfer(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert InvalidOwner(msg.sender);

        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function _hashClaim(Claim memory voucher) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CLAIM_TYPEHASH, voucher.account, voucher.tokenId, voucher.nonce, voucher.deadline
            )
        );
    }

    function _hashTypedData(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _domainSeparator() private view returns (bytes32) {
        return
            block.chainid == _deploymentChainId
                ? _deploymentDomainSeparator
                : _buildDomainSeparator();
    }

    function _buildDomainSeparator() private view returns (bytes32) {
        return keccak256(
            abi.encode(_DOMAIN_TYPEHASH, _NAME_HASH, _VERSION_HASH, block.chainid, address(this))
        );
    }

    function _recover(bytes32 digest, bytes calldata signature)
        private
        pure
        returns (address signer)
    {
        if (signature.length != 65) revert InvalidSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (uint256(s) > _SECP256K1_HALF_ORDER || (v != 27 && v != 28)) revert InvalidSignature();
        signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    function _checkERC1155Received(address recipient, uint256 tokenId) private {
        if (recipient.code.length == 0) return;

        (bool success, bytes memory result) = recipient.call(
            abi.encodeWithSelector(
                bytes4(0xf23a6e61), msg.sender, address(0), tokenId, uint256(1), bytes("")
            )
        );

        if (!success || result.length < 32 || abi.decode(result, (bytes4)) != bytes4(0xf23a6e61)) {
            revert UnsafeRecipient(recipient);
        }
    }

    function _toString(uint256 value) private pure returns (string memory result) {
        if (value == 0) return "0";

        uint256 digits;
        uint256 remaining = value;
        while (remaining != 0) {
            ++digits;
            remaining /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            --digits;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        result = string(buffer);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MetaStockToken is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    Ownable,
    ERC20Permit
{
    struct LockInfo {
        uint256 releaseTime;
        uint256 balance;
    }

    mapping(address => LockInfo[]) internal lockInfo;

    event Lock(address indexed holder, uint256 value, uint256 releaseTime);
    event Unlock(address indexed holder, uint256 value);

    constructor(
        address initialOwner
    )
        ERC20("Meta Stock Token", "METAS")
        Ownable(initialOwner)
        ERC20Permit("Meta Stock Token")
    {
        _mint(msg.sender, 200000000 * 10 ** decimals());
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function lock(
        address holder,
        uint256 value,
        uint256 releaseTime
    ) public onlyOwner {
        if (balanceOf(holder) < value) {
            revert ERC20InsufficientBalance(holder, balanceOf(holder), value);
        }
        require(
            block.timestamp <= releaseTime,
            "Lock Error: The release time is earlier than the current time."
        );
        _update(holder, address(0), value);
        lockInfo[holder].push(LockInfo(releaseTime, value));
        emit Lock(holder, value, releaseTime);
    }

    function unlock(address holder, uint256 i) public onlyOwner {
        require(i < lockInfo[holder].length, "Locked balance does not exists.");
        _update(address(0), holder, lockInfo[holder][i].balance);
        emit Unlock(holder, lockInfo[holder][i].balance);
        lockInfo[holder][i].balance = 0;

        if (i != lockInfo[holder].length - 1) {
            lockInfo[holder][i] = lockInfo[holder][lockInfo[holder].length - 1];
        }
        lockInfo[holder].pop();
    }

    function _releaseLock(address holder) internal {
        for (uint256 i = 0; i < lockInfo[holder].length; i++) {
            if (lockInfo[holder][i].releaseTime <= block.timestamp) {
                _update(address(0), holder, lockInfo[holder][i].balance);
                emit Unlock(holder, lockInfo[holder][i].balance);
                lockInfo[holder][i].balance = 0;

                if (i != lockInfo[holder].length - 1) {
                    lockInfo[holder][i] = lockInfo[holder][
                        lockInfo[holder].length - 1
                    ];
                    i--;
                }
                lockInfo[holder].pop();
            }
        }
    }

    function lockCount(address holder) public view returns (uint256) {
        return lockInfo[holder].length;
    }

    function lockState(
        address holder,
        uint256 idx
    ) public view returns (uint256, uint256) {
        return (
            lockInfo[holder][idx].releaseTime,
            lockInfo[holder][idx].balance
        );
    }

    function transferWithLock(
        address to,
        uint256 value,
        uint256 releaseTime
    ) public onlyOwner returns (bool) {
        address owner = _msgSender();
        if (to == address(0)) {
            revert ERC20InvalidReceiver(address(0));
        }
        if (balanceOf(owner) < value) {
            revert ERC20InsufficientBalance(owner, balanceOf(owner), value);
        }
        require(
            block.timestamp <= releaseTime,
            "TokenLockError: The release time is before the current time."
        );
        _update(owner, address(0), value);
        lockInfo[to].push(LockInfo(releaseTime, value));
        emit Transfer(owner, to, value);
        emit Lock(to, value, releaseTime);

        return true;
    }

    // The following functions are overrides required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function transfer(
        address to,
        uint256 value
    ) public override returns (bool) {
        address holder = _msgSender();
        _releaseLock(holder);
        return super.transfer(to, value);
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        _releaseLock(from);
        return super.transferFrom(from, to, value);
    }
}

import { expect } from "chai";
import { ethers } from "hardhat";

async function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

describe("MetaStockToken", function () {
  it("Test contract", async function () {
    const ContractFactory = await ethers.getContractFactory("MetaStockToken");

    const initialOwner = (await ethers.getSigners())[0];

    const user1 = (await ethers.getSigners())[1];
    const user2 = (await ethers.getSigners())[2];

    const instance = await ContractFactory.deploy(initialOwner);
    await instance.waitForDeployment();

    console.log("user1:", user1.address);
    console.log("user2:", user2.address);

    // * 토큰명 검증
    expect(await instance.name()).to.equal("Meta Stock Token");
    // * 토큰 심볼 검증
    expect(await instance.symbol()).to.equal("METAS");
    // * 토큰 데시멀 검증
    expect(await instance.decimals()).to.equal(6);
    // * 토큰 초기 발행량 검증
    const initialOwnerBalance = await instance.balanceOf(initialOwner.address);
    expect(initialOwnerBalance).to.equal(200000000 * 10 ** 6);
    // * 토큰 추가 발행 검증
    await instance.mint(user1, 1000 * 10 ** 6);
    const user1Balance = await instance.balanceOf(user1.address);
    expect(user1Balance).to.equal(1000 * 10 ** 6);
    // * 토큰 전송 검증
    await instance.connect(user1).transfer(user2.address, 100 * 10 ** 6);
    const user2Balance = await instance.balanceOf(user2.address);
    expect(user2Balance).to.equal(100 * 10 ** 6);
    // * 토큰 소각 검증
    await instance.connect(user2).burn(50 * 10 ** 6);
    const user2BalanceAfterBurn = await instance.balanceOf(user2.address);
    expect(user2BalanceAfterBurn).to.equal(50 * 10 ** 6);
    // * 토큰 포징 검증
    try {
      await instance.connect(user2).pause();
    } catch (error: any) {
      expect(error.toString()).include("OwnableUnauthorizedAccount");
    }
    await instance.connect(initialOwner).pause();
    const isPaused = await instance.paused();
    expect(isPaused).to.equal(true);
    try {
      await instance.connect(user2).transfer(user1.address, 10 * 10 ** 6);
    } catch (error: any) {
      expect(error.toString()).include("EnforcedPause()");
    }
    await instance.connect(initialOwner).unpause();
    await instance.connect(user2).transfer(user1.address, 50 * 10 ** 6);
    const user1BalanceAfterTransfer = await instance.balanceOf(user1.address);
    expect(user1BalanceAfterTransfer).to.equal(950 * 10 ** 6);
    // * 토큰 락 검증
    // ? 토큰 락 걸기
    const blockTime = BigInt((new Date().getTime() / 1000).toFixed(0));
    const releaseTime = blockTime + 15n;
    await instance.lock(user1.address, 150 * 10 ** 6, releaseTime);
    const balanceAfterLockUser1 = await instance.balanceOf(user1.address);
    expect(balanceAfterLockUser1).to.equal(800 * 10 ** 6);
    // ? 토큰 락 카운트 확인
    const lockCount = await instance.lockCount(user1.address);
    expect(lockCount).to.equal(1);
    // ? 토큰 락 정보 확인
    const lockInfo = await instance.lockState(user1.address, 0);
    expect(lockInfo[0]).to.equal(releaseTime);
    expect(lockInfo[1]).to.equal(BigInt(150 * 10 ** 6));
    // ? 토큰 이체
    try {
      await instance.connect(user1).transfer(user2.address, 900 * 10 ** 6);
    } catch (error: any) {
      expect(error.toString()).include("ERC20InsufficientBalance");
    }
    // ? 토큰락 해제
    await instance.unlock(user1.address, 0);
    const balanceAfterUnlockUser1 = await instance.balanceOf(user1.address);
    expect(balanceAfterUnlockUser1).to.equal(950 * 10 ** 6);
    const lockCountAfterUnlock = await instance.lockCount(user1.address);
    expect(lockCountAfterUnlock).to.equal(0);
    // ? 토큰 락 걸기
    await instance.lock(user1.address, 150 * 10 ** 6, blockTime + 12n);
    // ? 토큰 락 자동 해제
    await sleep(15);
    await instance.connect(user1).transfer(user2.address, 900 * 10 ** 6);
    const user1BalanceAfterTransfer2 = await instance.balanceOf(user1.address);
    expect(user1BalanceAfterTransfer2).to.equal(50 * 10 ** 6);
    const user2BalanceAfterTransfer2 = await instance.balanceOf(user2.address);
    expect(user2BalanceAfterTransfer2).to.equal(900 * 10 ** 6);

    // ? 락걸린 토큰 이체 확인
    const blockTime2 = BigInt((new Date().getTime() / 1000).toFixed(0));
    const releaseTime2 = blockTime2 + 15n;
    await instance.transferWithLock(user2.address, 100 * 10 ** 6, releaseTime2);
    const user2BalanceAfterTransfer3 = await instance.balanceOf(user2.address);
    expect(user2BalanceAfterTransfer3).to.equal(900 * 10 ** 6);
    const lockCountAfterTransfer = await instance.lockCount(user2.address);
    expect(lockCountAfterTransfer).to.equal(1);
    const lockInfoAfterTransfer = await instance.lockState(user2.address, 0);
    expect(lockInfoAfterTransfer[0]).to.equal(releaseTime2);
    expect(lockInfoAfterTransfer[1]).to.equal(BigInt(100 * 10 ** 6));
    await sleep(15);
    // ? 락해제 요청
    await instance.connect(user2).releaseLocks();
    const user2BalanceAfterTransfer4 = await instance.balanceOf(user2.address);
    expect(user2BalanceAfterTransfer4).to.equal(1000 * 10 ** 6);
    const lockCountAfterTransfer2 = await instance.lockCount(user2.address);
    expect(lockCountAfterTransfer2).to.equal(0);
    // * LockStateList 검증
    const blockTime3 = BigInt((new Date().getTime() / 1000).toFixed(0));
    await instance
      .connect(initialOwner)
      .lock(user2.address, 100 * 10 ** 6, blockTime3 + 1000n);
    await instance
      .connect(initialOwner)
      .lock(user2.address, 110 * 10 ** 6, blockTime3 + 1000n);
    await instance
      .connect(initialOwner)
      .lock(user2.address, 130 * 10 ** 6, blockTime3 + 1000n);
    await instance
      .connect(initialOwner)
      .lock(user2.address, 200 * 10 ** 6, blockTime3 + 1000n);
    const lockStateList = await instance.lockStateList(user2.address);
    expect(lockStateList[0][0]).to.equal(blockTime3 + 1000n);
    expect(lockStateList[0][1]).to.equal(BigInt(100 * 10 ** 6));
    expect(lockStateList[1][0]).to.equal(blockTime3 + 1000n);
    expect(lockStateList[1][1]).to.equal(BigInt(110 * 10 ** 6));
    expect(lockStateList[2][0]).to.equal(blockTime3 + 1000n);
    expect(lockStateList[2][1]).to.equal(BigInt(130 * 10 ** 6));
    expect(lockStateList[3][0]).to.equal(blockTime3 + 1000n);
    expect(lockStateList[3][1]).to.equal(BigInt(200 * 10 ** 6));
    // * 토큰 투표 검증
    // ? 투표정보 갱신
    const blockTime4 = BigInt((new Date().getTime() / 1000).toFixed(0)) + 1000n;
    await instance
      .connect(initialOwner)
      .updateVoteInfo(1, 1 * 10 ** 6, 4, blockTime4);
    const voteInfo = await instance.getVoteInfo();
    expect(voteInfo[0]).to.equal(1);
    expect(voteInfo[1]).to.equal(1 * 10 ** 6);
    expect(voteInfo[2]).to.equal(4);
    expect(voteInfo[3]).to.equal(blockTime4);

    // uint256 proposalId,  // 투표 아이디
    // uint256 threshold,   // 최소 투표가능 토큰량
    // uint256 quorum,      // 정족수%
    // uint256 endDate      // 투표 종료 시점
    // ? 투표하기
    try {
      await instance.connect(user2).vote(1, 0.5 * 10 ** 6, 0);
    } catch (error: any) {
      expect(error.toString()).include("threshold");
    }

    try {
      await instance.connect(user2).vote(3, 10 * 10 ** 6, 0);
    } catch (error: any) {
      expect(error.toString()).include("proposalId");
    }

    try {
      await instance.connect(user2).vote(1, 10 * 10 ** 6, -1);
    } catch (error: any) {
      expect(error.toString()).include("option");
    }

    await instance.connect(user2).vote(1, 10 * 10 ** 6, 0);
    await instance.connect(user2).vote(1, 100 * 10 ** 6, 1);

    const voteHistory = await instance.connect(user2).getVoteHistory(1, 0);
    const voteHistory2 = await instance.connect(user2).getVoteHistory(1, 1);
    expect(voteHistory[0]).to.equal(0);
    expect(voteHistory[1]).to.equal(10 * 10 ** 6);
    expect(voteHistory2[0]).to.equal(1);
    expect(voteHistory2[1]).to.equal(100 * 10 ** 6);
    const voteHistoryList = await instance.connect(user2).getVoteHistoryList(1);
    // ? 투표결과 확인
    expect(voteHistoryList[0][0]).to.equal(0);
    expect(voteHistoryList[0][1]).to.equal(10 * 10 ** 6);
    expect(voteHistoryList[1][0]).to.equal(1);
    expect(voteHistoryList[1][1]).to.equal(100 * 10 ** 6);
  });
});

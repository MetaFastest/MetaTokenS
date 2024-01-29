import { expect } from "chai";
import { ethers } from "hardhat";

describe("MetaStockToken", function () {
  it("Test contract", async function () {
    const ContractFactory = await ethers.getContractFactory("MetaStockToken");

    const initialOwner = (await ethers.getSigners())[0];

    const user1 = (await ethers.getSigners())[1];
    const user2 = (await ethers.getSigners())[2];

    const instance = await ContractFactory.deploy(initialOwner);
    await instance.waitForDeployment();

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
    try {
      await instance.connect(user2).transfer(user1.address, 10 * 10 ** 6);
    } catch (error: any) {
      expect(error.toString()).include("EnforcedPause()");
    }
    await instance.connect(initialOwner).unpause();
    await instance.connect(user2).transfer(user1.address, 50 * 10 ** 6);
    const user1BalanceAfterTransfer = await instance.balanceOf(user1.address);
    expect(user1BalanceAfterTransfer).to.equal(950 * 10 ** 6);
  });
});

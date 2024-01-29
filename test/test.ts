import { expect } from "chai";
import { ethers } from "hardhat";

describe("MetaStockToken", function () {
  it("Test contract", async function () {
    const ContractFactory = await ethers.getContractFactory("MetaStockToken");

    const initialOwner = (await ethers.getSigners())[0].address;

    console.log("initialOwner", initialOwner);

    const instance = await ContractFactory.deploy(initialOwner);
    await instance.waitForDeployment();

    expect(await instance.name()).to.equal("Meta Stock Token");
  });
});

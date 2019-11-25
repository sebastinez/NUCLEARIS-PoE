import Contract from '../classes/Contract';
import * as utils from '../config/utils';
import * as pending from '../config/pendingTx';
import txModel from '../models/transaction';
import fs from 'fs';
import logger from '../config/winston';
import { Request, Response } from 'express';

const processABI = require('../../build/contracts/Process.json').abi;

export async function create(req: Request, res: Response) {
  try {
    const { address, privateKey } = await utils.getKeys(req.body);

    const processTitle = utils.asciiToHex(req.body.processTitle);
    const supplierAddress = utils.toChecksumAddress(req.body.supplierAddress);

    const contract = new Contract({
      privateKey
    });
    const txHash = await contract.sendDataToContract({
      fromAddress: address,
      method: 'createProcess',
      data: [supplierAddress, processTitle]
    });

    await pending.create({
      txHash,
      subject: 'add-process',
      data: [req.body.processTitle, supplierAddress]
    });

    logger.info(`Process created `, {
      title: req.body.processTitle,
      supplier: req.body.supplierAddress
    });
    res.json(txHash);
  } catch (e) {
    logger.error(`Process was not created`, {
      title: req.body.processTitle,
      supplier: req.body.supplierAddress
    });
    res.status(500).json({ error: e.message });
  }
}
export async function getOne(req: Request, res: Response) {
  try {
    const contract = new Contract();

    const process = new Contract({
      abi: processABI,
      contractAddress: req.query.contract
    });

    const details = await process.getDataFromContract({
      method: 'getDetails'
    });

    const userName = await contract.getDataFromContract({
      method: 'getUserDetails',
      data: [details[1]]
    });

    res.json({
      NuclearPoEAddress: details[0],
      supplierAddress: details[1],
      supplierName: utils.hexToAscii(userName[0]),
      processName: utils.hexToAscii(details[2]),
      allDocuments: details[3],
      contractAddress: details[4]
    });
  } catch (e) {
    logger.error(`Process ${req.query.contract} could not be obtained `, {
      message: e.message
    });
    res.json({ error: e.message });
  }
}

export async function getByID(req: Request, res: Response) {
  try {
    const contract = new Contract();

    const processContractsByExpediente = await contract.getDataFromContract({
      method: 'getProcessContractsByProject',
      data: [req.query.expediente]
    });

    const AssignmentDetails = processContractsByExpediente.map(
      async (processContractAddress: string) => {
        const process = new Contract({
          abi: processABI,
          contractAddress: processContractAddress
        });
        const details = await process.getDataFromContract({
          method: 'getDetails'
        });
        const userName = await contract.getDataFromContract({
          method: 'getUserDetails',
          data: [details[1]]
        });
        return {
          NuclearPoEAddress: details[0],
          supplierAddress: details[1],
          supplierName: utils.hexToAscii(userName[0]),
          processName: utils.hexToAscii(details[2]),
          allDocuments: details[3],
          contractAddress: details[4]
        };
      }
    );
    Promise.all(AssignmentDetails).then(details => {
      res.json(details);
    });
  } catch (e) {
    logger.error(`ProcessListByID could not be obtained `, {
      message: e.message
    });
    res.json({ error: e.message });
  }
}

export async function get(req: Request, res: Response) {
  try {
    const contract = new Contract();
    const processContracts = await contract.getDataFromContract({
      method: 'getAllProcessContracts'
    });

    const allProcessDetails = processContracts.map(async (address: string) => {
      const processContract = new Contract({
        abi: processABI,
        contractAddress: address
      });
      const details = await processContract.getDataFromContract({
        method: 'getDetails'
      });

      await txModel.deleteMany({
        subject: 'add-process',
        data: { $in: details[1] }
      });

      const userName = await contract.getDataFromContract({
        method: 'getUserDetails',
        data: [details[1]]
      });

      if (
        details[1] === req.user.address ||
        req.user.address === process.env.ADMINADDRESS
      )
        return {
          supplierAddress: details[1],
          supplierName: utils.hexToAscii(userName[0]),
          processName: utils.hexToAscii(details[2]),
          allDocuments: details[3],
          processContracts: details[4]
        };
      return {};
    });

    const pendingTx = await txModel.find({ subject: 'add-process' });

    Promise.all(allProcessDetails).then(processDetails => {
      res.json(processDetails.concat(pendingTx));
    });
  } catch (e) {
    logger.error(`ProcessList could not be obtained `, { message: e.message });
    res.json({ error: e.message });
  }
}

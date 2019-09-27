const express = require('express');
const { asyncMiddleware } = require('../middleware/index');
const Wallet = require('../classes/Wallet');
const NuclearPoE = require('../classes/NuclearPoE');
const Client = require('../classes/Client');
const ClientModel = require('../models/client');

const router = express.Router({ mergeParams: true });

router.post(
  '/',
  asyncMiddleware(async (req, res) => {
    try {
      const wallet = new Wallet(true);

      // Generation of encrypted privatekey and address
      wallet
        .generateWifPrivateKey()
        .generatePublicKey()
        .generateRSKAddress()
        .encryptBIP38(req.body.passphrase)
        .toHex(['rskAddressFromPublicKey']);

      const nuclear = new NuclearPoE(req.body.wallet, req.body.privateKey);
      const tx = await nuclear.createThirdParty(
        wallet.rskAddressFromPublicKey,
        req.body.clientName,
        'createClient',
        'CreateClient'
      );

      // Create DB record and hash password
      const result = await ClientModel.register(
        new ClientModel({
          username: req.body.clientName,
          email: req.body.email,
          address: wallet.rskAddressFromPublicKey,
          contract: tx.contractAddress,
          encryptedPrivateKey: wallet.encryptedKey
        }),
        req.body.password
      );

      res.json({ result });
    } catch (e) {
      res.json({ error: e.message });
    }
  })
);

router.post(
  '/change',
  asyncMiddleware(async (req, res) => {
    try {
      const wallet = new Wallet(true);
      const client = await ClientModel.findById('');

      // Generation of encrypted privatekey and address
      wallet
        .decryptBIP38(client.encryptedPrivateKey, req.body.passphrase)
        .encryptBIP38(req.body.newPassphrase);

      const updatedClient = await ClientModel.findByIdAndUpdate('id', {
        encryptedPrivateKey: wallet.encryptedPrivateKey
      });

      res.json(updatedClient);
    } catch (e) {
      res.json({ error: e.message });
    }
  })
);

router.post('/get/:contract', (req, res) => {
  try {
    const client = new Client(
      req.params.contract,
      req.body.wallet,
      req.body.privateKey
    );

    const result = client.getClientDetails();
    res.json({ result });
  } catch (e) {
    res.json({ error: e.message });
  }
});

module.exports = router;

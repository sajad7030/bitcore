#!/usr/bin/env node
const config = require('../../ts_build/config').default;
const { Storage } = require('../../ts_build');

const startDate = new Date('2011-01-01T00:00:00.000Z');
const endDate = new Date();

const networkMapping = { 
  eth: {
    testnet: 'goerli'
  },
  btc: {
    testnet: 'testnet3'
  },
  bch: {
    testnet: 'testnet3'
  },
  doge: {
    testnet: 'testnet3'
  },
  ltc: {
    testnet: 'testnet4',
  },
  matic: {
    testnet: 'mumbai'
  },
  arb: {
    testnet: 'sepolia'
  },
  base: {
    testnet: 'sepolia'
  },
  op: {
    testnet: 'sepolia'
  }

};

const doit = process.argv[2] === '--doit';

if (!doit) {
  console.log('Dry run (pass --doit to actually do it)');
} else {
  console.log('LET\'S DO IT FOR REAL');
}

const storage = new Storage();
storage.connect(config.storageOpts, async (err) => {
  if (err) {
    console.log(err);
    return;
  }
  
  function done(err) {
    if (err) { console.log(err) }
    storage.disconnect(() => { console.log('done'); });
  }

  try {
    // Get all wallets
    const walletStream = storage.db.collection(Storage.collections.WALLETS).find({});

    let fixAddressCount = 0;
    let fixWalletsCount = 0;
    let fixTxsCount = 0;
    let count = 0;
    for await (const wallet of walletStream) {
      count++;
      if (count % 100 === 0) {
        console.log(`Processed ${count} wallets`); // shows how fast things are working
      }
      // if wallet chain is not covered or if network isn't testnet then skip
      if (!(Object.keys(networkMapping).includes(wallet.chain || wallet.coin) && wallet.network == 'testnet')) {
        continue;
      }

      if (doit) {
        // Update Wallets collection
        const resWallet = await storage.db.collection(Storage.collections.WALLETS).updateMany({
          id: wallet.id,
          network: 'testnet'
        }, {
          $set: { network: networkMapping[wallet.chain || wallet.coin].testnet }
        });

        if (resWallet?.result?.nModified > 0) {
          fixWalletsCount++;
        } else if (!resWallet?.result?.ok) {
          console.log(JSON.stringify(res));
        }

        // Update Addresses collection
        const resAddress = await storage.db.collection(Storage.collections.ADDRESSES).updateMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: 'testnet'
        }, {
          $set: { network: networkMapping[wallet.chain || wallet.coin].testnet }
        });

        if (resAddress?.result?.nModified > 0) {
          fixAddressCount++;
        } else if (!resAddress?.result?.ok) {
          console.log(JSON.stringify(res));
        }

        // Update Wallets collection
        const resTxs = await storage.db.collection(Storage.collections.TXS).updateMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: 'testnet'
        }, {
          $set: { network: networkMapping[wallet.chain || wallet.coin].testnet }
        });

        // Also update changeAddress and escrowAddress network if they exist
        await storage.db.collection(Storage.collections.TXS).updateMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          'changeAddress.network': 'testnet'
        }, {
          $set: { 'changeAddress.network': networkMapping[wallet.chain || wallet.coin].testnet }
        });
        await storage.db.collection(Storage.collections.TXS).updateMany({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          'escrowAddress.network': 'testnet'
        }, {
          $set: { 'escrowAddress.network': networkMapping[wallet.chain || wallet.coin].testnet }
        });

        if (resTxs?.result?.nModified > 0) {
          fixTxsCount++;
        } else if (!resTxs?.result?.ok) {
          console.log(JSON.stringify(res));
        }
      } else {
        // Update Wallets collection
        const walletCount = await storage.db.collection(Storage.collections.WALLETS).countDocuments({
          id: wallet.id,
          network: 'testnet'
        });
        fixWalletsCount += walletCount;

        // Update Addresses collection
        const addressCount = await storage.db.collection(Storage.collections.ADDRESSES).countDocuments({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: 'testnet'
        });

        fixAddressCount+= addressCount;

        // Update Wallets collection
        const txsCount = await storage.db.collection(Storage.collections.TXS).countDocuments({
          walletId: wallet.id,
          createdOn: { $gte: startDate.getTime() / 1000, $lte: endDate.getTime() / 1000 }, // Included only to use index
          network: 'testnet'
        });

        fixTxsCount += txsCount;
      }
      await new Promise(resolve => setTimeout(resolve, 80)); // sleep 80ms
    }

    console.log(`Fixed ${fixWalletsCount} wallets`);
    console.log(`Fixed ${fixAddressCount} Addresses`);
    console.log(`Fixed ${fixTxsCount} Txs`);

    return done();
  } catch (err) {
    return done(err);
  }
});

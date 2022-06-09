import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { programs, Wallet } from "@metaplex/js";
import { createAuctionHouse, updateAuctionHouse } from "./instructions";
import { MarktplaceSettingsPayload, AuctionHouse } from "./types";
import ipfsSDK from "./ipfs";
import { Client } from "./client";
import { OffersClient } from "./offers";
import { ListingsClient } from "./listings";

const {
  metaplex: { Store, SetStoreV2, StoreConfig },
} = programs;

export interface MarketplaceClientParams {
  connection: Connection;
  wallet: Wallet;
}

export class MarketplaceClient extends Client {
  async create(settings: MarktplaceSettingsPayload, transactionFee: number) {
    const wallet = this.wallet;
    const publicKey = wallet.publicKey as PublicKey;
    const connection = this.connection;

    const storePubkey = await Store.getPDA(publicKey);
    const storeConfigPubkey = await StoreConfig.getPDA(storePubkey);

    settings.address.store = storePubkey.toBase58();
    settings.address.storeConfig = storeConfigPubkey.toBase58();
    settings.address.owner = publicKey.toBase58();

    const storefrontSettings = new File(
      [JSON.stringify(settings)],
      "storefront_settings"
    );
    const { uri } = await ipfsSDK.uploadFile(storefrontSettings);

    const auctionHouseCreateInstruction = await createAuctionHouse({
      wallet: wallet as any,
      sellerFeeBasisPoints: transactionFee,
      treasuryWithdrawalDestination: this.wallet.publicKey.toBase58(),
      feeWithdrawalDestination: this.wallet.publicKey.toBase58(),
    });

    const setStorefrontV2Instructions = new SetStoreV2(
      {
        feePayer: publicKey,
      },
      {
        admin: publicKey,
        store: storePubkey,
        config: storeConfigPubkey,
        isPublic: false,
        settingsUri: uri,
      }
    );

    const transaction = new Transaction();

    transaction.add(auctionHouseCreateInstruction);
    transaction.add(setStorefrontV2Instructions);

    transaction.feePayer = wallet.publicKey as any;
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    const signedTransaction = await wallet.signTransaction(transaction);

    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );

    if (txtId) await connection.confirmTransaction(txtId);
  }

  async update(
    settings: MarktplaceSettingsPayload,
    transactionFee: number
  ): Promise<void> {
    const wallet = this.wallet;
    const publicKey = wallet.publicKey as PublicKey;
    const connection = this.connection;

    const storePubkey = await Store.getPDA(publicKey);
    const storeConfigPubkey = await StoreConfig.getPDA(storePubkey);

    settings.address.store = storePubkey.toBase58();
    settings.address.storeConfig = storeConfigPubkey.toBase58();
    settings.address.owner = publicKey.toBase58();

    const storefrontSettings = new File(
      [JSON.stringify(settings)],
      "storefront_settings"
    );
    const { uri } = await ipfsSDK.uploadFile(storefrontSettings);

    const auctionHouseUpdateInstruction = await updateAuctionHouse({
      wallet: wallet as Wallet,
      sellerFeeBasisPoints: transactionFee,
    });

    const setStorefrontV2Instructions = new SetStoreV2(
      {
        feePayer: publicKey,
      },
      {
        admin: publicKey,
        store: storePubkey,
        config: storeConfigPubkey,
        isPublic: false,
        settingsUri: uri,
      }
    );
    const transaction = new Transaction();

    if (auctionHouseUpdateInstruction) {
      transaction.add(auctionHouseUpdateInstruction);
    }

    transaction.add(setStorefrontV2Instructions);
    transaction.feePayer = publicKey;
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;

    const signedTransaction = await wallet.signTransaction(transaction);
    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    );

    if (txtId) await connection.confirmTransaction(txtId, "confirmed");
  }

  offers(auctionHouse: AuctionHouse): OffersClient {
    return new OffersClient(this.connection, this.wallet, auctionHouse);
  }

  listings(auctionHouse: AuctionHouse): ListingsClient {
    return new ListingsClient(this.connection, this.wallet, auctionHouse);
  }
}

export const initMarketplaceSDK = (
  connection: Connection,
  wallet: Wallet
): MarketplaceClient => {
  return new MarketplaceClient(connection, wallet);
};

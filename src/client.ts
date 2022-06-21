import {
  Connection,
} from '@solana/web3.js'
import { Wallet } from '@metaplex/js'
import { TransactionBuilder } from './transaction'

export abstract class Client {
  public connection: Connection
  public wallet: Wallet


  constructor(connection: Connection, wallet: Wallet) {
    this.connection = connection
    this.wallet = wallet
  }

  transaction() {
    return new TransactionBuilder(this.connection, this.wallet)
  }
}

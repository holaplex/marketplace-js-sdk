import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { Wallet } from '@metaplex/js'

export abstract class Client {
  public connection: Connection
  public wallet: Wallet
  private _transaction: Transaction

  constructor(connection: Connection, wallet: Wallet) {
    this.connection = connection
    this.wallet = wallet
  }

  transaction() {
    this._transaction = new Transaction()
    return this
  }

  addInstructions(instructions: TransactionInstruction[]) {
    this._transaction.add(...instructions)
    return this
  }

  addTransaction(transaction: Transaction) {
    this._transaction.add(transaction)
    return this
  }

  async send() {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection
    const transaction = this._transaction

    transaction.feePayer = publicKey
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash

    const signedTransaction = await wallet.signTransaction(transaction)
    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    if (txtId) await connection.confirmTransaction(txtId, 'confirmed')
  }
}

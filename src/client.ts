import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionInstructionCtorFields,
} from '@solana/web3.js'
import { Wallet } from '@metaplex/js'

export type Tx =
  | Transaction
  | TransactionInstruction
  | TransactionInstructionCtorFields
export type TxPromise = Promise<Tx>

export type TxContainer = TxPromise | Tx

export abstract class Client {
  public connection: Connection
  public wallet: Wallet
  private _transactionBuilder: Array<TxContainer>

  constructor(connection: Connection, wallet: Wallet) {
    this.connection = connection
    this.wallet = wallet
  }

  transaction() {
    this._transactionBuilder = new Array<TxContainer>()
    return this
  }

  add(...input: TxContainer[]) {
    this._transactionBuilder.push(...input)
    return this
  }

  async send() {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection

    const transaction = new Transaction()
    const txs = await Promise.all(this._transactionBuilder)
    txs.forEach((tx) => {
      transaction.add(tx)
    })
    transaction.feePayer = publicKey
    transaction.recentBlockhash = (
      await connection.getRecentBlockhash()
    ).blockhash

    const signedTransaction = await wallet.signTransaction(transaction)
    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    if (txtId) await connection.confirmTransaction(txtId, 'confirmed')
  }
}

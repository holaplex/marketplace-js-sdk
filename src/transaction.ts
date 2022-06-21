import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionInstructionCtorFields,
  Keypair
} from '@solana/web3.js'
import { Wallet } from '@metaplex/js'

export type Tx =
  | Transaction
  | TransactionInstruction
  | TransactionInstructionCtorFields
export type PendingTransaction = [Tx, Keypair[]]

export class TransactionBuilder {
  public connection: Connection
  public wallet: Wallet
  private transactions: Promise<PendingTransaction>[]

  constructor(connection: Connection, wallet: Wallet) {
    this.connection = connection
    this.wallet = wallet
    this.transactions = []
  }

  add(transaction: Promise<PendingTransaction>): TransactionBuilder {
    this.transactions = [...this.transactions, transaction]
    return this
  }

  async send() {
    const wallet = this.wallet
    const publicKey = wallet.publicKey as PublicKey
    const connection = this.connection
    let signers: Keypair[] = []

    const transaction = new Transaction()
    const txs = await Promise.all(this.transactions)
    txs.forEach(([tx, keypairs]) => {
      signers = [...signers, ...keypairs]

      transaction.add(tx)
    })
    
    transaction.feePayer = publicKey
    const recentBlockhash = await connection.getRecentBlockhash()
    
    transaction.recentBlockhash = recentBlockhash.blockhash

    const signerPubKeys = signers.map((signer) => signer.publicKey)
    transaction.setSigners(publicKey, ...signerPubKeys)

    if (signers.length > 0) {
      transaction.partialSign(...signers)
    }
  
    const signedTransaction = await wallet.signTransaction(transaction)
    const txtId = await connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    if (txtId) await connection.confirmTransaction(txtId, 'confirmed')
  }

}
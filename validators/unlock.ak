use aiken/hash.{Blake2b_224, Hash}
use aiken/list
use aiken/transaction.{
  OutputReference, ScriptContext, Spend, Transaction, TransactionId,
}
use aiken/transaction/credential.{VerificationKey}

type MyRedeemer {
  message: ByteArray,
}

type PubKeyHash =
  Hash<Blake2b_224, VerificationKey>

type MyDatum {
  owner: PubKeyHash,
}

const unlock_message = "aiken rocks"

validator {
  fn unlock(datum: MyDatum, redeemer: MyRedeemer, context: ScriptContext) {
    let must_be_signed =
      list.has(context.transaction.extra_signatories, datum.owner)

    must_be_signed && redeemer.message == unlock_message
    // let MyDatum { owner } = datum
    // let MyRedeemer { message } = redeemer
    // let ScriptContext { purpose, .. } = context

    // when purpose is {
    //   Spend(_oref) -> {
    //     let must_be_signed =
    //       list.has(context.transaction.extra_signatories, owner)

    //     must_be_signed && message == "hello world"
    //   }
    //   _ -> False
    // }
  }
}

// Validator Tests
test unlock_test_fail_message() fail {
  let redeemer = MyRedeemer { message: "wrong message" }
  let datum =
    MyDatum {
      owner: #"00000000000000000000000000000000000000000000000000000000",
    }

  let placeholder_oref =
    OutputReference { transaction_id: TransactionId(""), output_index: 0 }
  let context =
    ScriptContext {
      purpose: Spend(placeholder_oref),
      transaction: transaction.placeholder(),
    }

  unlock(datum, redeemer, context)
}

test unlock_test_fail_owner() fail {
  let redeemer = MyRedeemer { message: unlock_message }
  let datum =
    MyDatum {
      owner: #"00000000000000000000000000000000000000000000000000000000",
    }

  let placeholder_oref =
    OutputReference { transaction_id: TransactionId(""), output_index: 0 }
  let context =
    ScriptContext {
      purpose: Spend(placeholder_oref),
      transaction: transaction.placeholder(),
    }

  unlock(datum, redeemer, context)
}

test unlock_test() {
  let redeemer = MyRedeemer { message: unlock_message }
  let datum =
    MyDatum {
      owner: #"00000000000000000000000000000000000000000000000000000000",
    }

  let placeholder_oref =
    OutputReference { transaction_id: TransactionId(""), output_index: 0 }
  let context =
    ScriptContext {
      purpose: Spend(placeholder_oref),
      transaction: transaction.placeholder()
        |> fn(transaction) {
            Transaction { ..transaction, extra_signatories: [datum.owner] }
          },
    }

  unlock(datum, redeemer, context)
}

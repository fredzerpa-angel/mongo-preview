const mongoose = require('mongoose');
const amountSchema = require('../schemas/amounts.schema');

const paymentSchema = new mongoose.Schema({
  schoolTerm: {
    type: String,
    required: false,
  },
  concept: {
    type: String,
    required: false,
  },
  billId: {
    type: Number,
    required: false,
  },
  amount: {
    type: amountSchema,
    required: false,
  },
  // Este valor esta dado en Bs en Arcadat
  discount: {
    type: amountSchema,
    required: false,
  },
  // Credit significa que este pago es un abono
  isCredit: {
    type: Boolean,
    required: false,
  },
  // Que el pago fue anulado
  canceled: {
    type: Boolean,
    default: false,
    required: false,
  },

  time: {
    date: {
      type: Date,
      required: false,
    },
    hour: {
      type: String,
      required: false,
    },
    datetime: {
      type: Date,
      required: false,
    },
    timezone: {
      type: String,
      required: false,
    },
  },

  paymentHolder: {
    fullname: {
      type: String,
      required: false,
    },
    refId: {
      type: String,
      required: false,
    },
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: false,
  },
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: false,
  },
});

module.exports = mongoose.model('Payment', paymentSchema);

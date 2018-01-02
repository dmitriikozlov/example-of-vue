/* ============
 * Edit Page
 * ============
 *
 * This is the page for editing bill and credit note.
 */
import moment from 'moment';
import { mapGetters } from 'vuex';
import store from './../../../../store';
import billTypeService from './../../../../services/billType';
import billStatusService from './../../../../services/billStatus';
import orderService from './../../../../services/order';
import clientService from './../../../../services/client';
import billService from './../../../../services/bill';
import invoiceService from './../../../../services/invoice';
import creditNoteService from './../../../../services/creditNote';
import Forms from './../../../../utils/forms/forms';

export default {
  data() {
    return {
      form: new Forms({
        orderId: {
          value: '',
          type: 'select',
        },
        billStatusId: {
          value: '',
          type: 'hidden',
        },
        date: {
          value: '',
          type: 'date',
        },
        dueDate: {
          value: '',
          type: 'date',
        },
        paymentDate: {
          value: '',
          type: 'date',
        },
        creditNoteSource: {
          value: '',
          type: 'hidden',
        },
        note: {
          value: '',
          type: 'textarea',
        },
      }),
      successMessage: '',
      loadingCreditNote: false,
      sendLoading: false,
      loading: false,
      hashid: '',
      roundInvoiceTotal: true,
    };
  },

  computed: {
    ...mapGetters({
      orders: 'allOrders',
      clients: 'allClients',
      billTypes: 'billTypes',
      billStatuses: 'billStatuses',
      currentBill: 'currentBill',
    }),

    /**
     * Checks if it is the credit note route.
     */
    isCreditNote() {
      return this.$route.name === 'bills.creditNote';
    },

    /**
     * Check if it is still a draft.
     */
    isDraft() {
      return this.currentBill.billStatus === 'Draft';
    },

    /**
     * Check if it is still pending.
     */
    isPending() {
      return this.currentBill.billStatus === 'Pending';
    },

    /**
     * Check if it is sent.
     */
    isSent() {
      return this.currentBill.billStatus === 'Sent';
    },

    /**
     * Check if it is cleared.
     */
    isCleared() {
      return this.currentBill.billStatus === 'Cleared';
    },

    /**
     * Gets the bill order.
     */
    currentOrder() {
      const currentOrder = this.orders.all.filter(o => (
        o.id.toString() === this.form.orderId.toString()
      ));

      if (currentOrder.length === 0) {
        return {};
      }

      return currentOrder[0];
    },

    /**
     * Gets the edi of order
     */
    currentEdiOrder() {
      if (this.currentOrder.ediOrder) {
        return this.currentOrder.ediOrder;
      }

      return {};
    },

    /**
     * Is EDI
     */
    isEdiOrder() {
      if (this.currentEdiOrder.id) {
        return true;
      }

      return false;
    },

    /**
     * Gets the bill current client based on the order.
     */
    currentClient() {
      if (Object.keys(this.currentOrder).length === 0) {
        return {};
      }

      const currentClient = this.clients.filter(c => (
        c.id.toString() === this.currentOrder.clientId.toString()
      ));

      if (currentClient.length === 0) {
        return {};
      }

      return currentClient[0];
    },

    /**
     * Determines if the credit note source is badly missing.
     */
    /* eslint max-len: ["error", 150] */
    noCreditNoteSource() {
      if (this.currentEdiOrder !== {} && (this.currentEdiOrder.ediOrderTypeId === 2 || this.currentEdiOrder.ediOrderTypeId === 3)) {
        return false;
      }

      if (this.currentBill.creditNoteSource > 0 && (this.currentOrder.orderTypeId === 1 || this.currentEdiOrder.ediOrderTypeId === 1)) {
        return true;
      }

      return false;
    },
  },

  watch: {
    $route() {
      this.toggleDueDate();
      this.togglePaymentDate();
      this.show();
    },

    /**
     * Watches state update to inject on Forms class.
     *
     * @param  {Object} billTypes    The billTypes list.
     */
    billTypes(billTypes) {
      this.form.setOptions('billTypeId', billTypes);
    },

    /**
     * Watches state update to inject on Forms class.
     *
     * @param  {Object} billStatuses    The billStatuses list.
     */
    billStatuses(billStatuses) {
      this.form.setOptions('billStatusId', billStatuses.map(s => (
        { id: s.id, name: s.status }
      )));
    },

    /**
    * Watches state update to inject on Forms class.
    *
    * @param  {Object} orders    The orders list.
    */
    orders(orders) {
      this.form.setOptions('orderId', orders.all.map(o => (
        { id: o.id, name: o.number }
      )));
    },

    /**
     * Watches state update to inject on Forms class.
     *
     * @param  {Object} currentBill    The bill.
     */
    currentBill(currentBill) {
      this.form.assignData(currentBill);
      this.disableIfSent();
      this.togglePaymentDate();
    },
  },

  created() {
    this.toggleDueDate();
    this.togglePaymentDate();
    this.show();
  },

  methods: {
    /**
     * Show and hide due date field.
     */
    toggleDueDate() {
      if (this.isCreditNote) {
        this.form.hideField('dueDate');
      } else {
        this.form.showField('dueDate');
      }
    },

    /**
     * Show and hide payment date field.
     */
    togglePaymentDate() {
      if (!this.isCreditNote && this.isCleared) {
        this.form.showField('paymentDate');
      } else {
        this.form.hideField('paymentDate');
      }
    },

    markAsCleared() {
      this.form.paymentDate = moment().format();
      this.save('Cleared');
    },

    /**
     * Adds the bill status to the form before saving.
     *
     * @param {String} name The status name.
     */
    save(name) {
      this.form.loading = name;
      const status = this.billStatuses.filter(s => (
        s.status === name
      ))[0];

      this.form.billStatusId = status.id;

      this.update();
    },

    /**
     * Method to update the bill.
     */
    update() {
      const service = this.isCreditNote ? creditNoteService : billService;
      service.update(store.state.route.params.id, this.form.data())
      .then(() => {
        this.successMessage = this.$t('static.bills.edit.updateSuccess');
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
        this.form.loading = false;
      }).catch((errors) => {
        if (errors.code === 40116) {
          errors = {
            orderId: [this.$t('static.bills.create.orderError')],
          };
        }

        this.form.loading = false;
        this.form.recordErrors(errors);
      });
    },

    /**
     * If order has been sent.
     */
    disableIfSent() {
      const fields = Object.keys(this.form.fields).filter(k => k !== 'paymentDate');
      if (this.isDraft || this.isPending) {
        fields.map(f => this.form.enableField(f));
        return;
      }

      fields.map(f => this.form.disableField(f));
    },

    /**
     * Fetches the bill object for editing.
     */
    show() {
      this.loading = true;
      Promise.all([
        billService.show(store.state.route.params.id),
        billTypeService.all(),
        orderService.all(),
        billStatusService.all(),
        clientService.all(),
      ]).then((data) => {
        this.hashid = data[0].hashid;
        this.roundInvoiceTotal = data[0].roundInvoiceTotal;
        this.loading = false;
      });
    },

    /**
     * Send the invoice to the client email.
     */
    sendInvoice() {
      this.sendLoading = true;
      invoiceService.send(store.state.route.params.id)
      .then(() => {
        this.sendLoading = false;
        billService.show(store.state.route.params.id);
        orderService.all();
        this.$message({
          showClose: true,
          message: this.$t('static.bills.edit.sendInvoiceSuccess'),
          type: 'success',
        });
      }).catch(() => {
        this.sendLoading = false;
        this.$message({
          showClose: true,
          message: this.$t('static.bills.edit.sendInvoiceError'),
          type: 'error',
        });
      });
    },

    /**
     * Send the EDI invoice to the FTP.
     */
    sendBillEDI() {
      this.sendLoading = true;
      invoiceService.sendEDI(store.state.route.params.id, this.currentOrder.ediOrderId)
      .then((data) => {
        this.sendLoading = false;
        if (data.xml) {
          this.$msgbox({
            title: 'XML',
            message: data.xml,
            customClass: 'xmlModalCustomClass',
          });
        } else {
          this.$message({
            showClose: true,
            message: this.$t('static.bills.edit.sendInvoiceSuccess'),
            type: 'success',
          });
        }
        billService.show(store.state.route.params.id);
      }).catch(() => {
        this.$message({
          showClose: true,
          message: this.$t('static.bills.edit.sendInvoiceError'),
          type: 'error',
        });
      });
    },

    /**
     * Show the invoice pdf in another window.
     */
    showInvoice() {
      if (this.isCreditNote) {
        creditNoteService.show(this.hashid);
        return;
      }
      invoiceService.show(this.hashid);
    },

    /**
     * Redirects to credit note creation page.
     */
    createCreditNote() {
      this.loadingCreditNote = true;
      creditNoteService.store(store.state.route.params.id)
      .then((bill) => {
        this.$router.replace({
          name: 'bills.creditNote',
          params: {
            id: bill.id,
          },
        });
        window.scrollTo(0, 0);
        this.loadingCreditNote = false;
      }).catch(() => {
        this.$message({
          showClose: true,
          message: this.$t('static.bills.edit.createNoteError'),
          type: 'error',
        });
        this.loadingCreditNote = false;
      });
    },

    /**
    * Updates the current bill round invoice total
    **/
    roundInvoice() {
      billService.updateRoundInvoiceTotal(store.state.route.params.id, this.roundInvoiceTotal)
      .then(() => {
        this.successMessage = this.$t('static.bills.edit.updateSuccess');
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      }).catch(() => {
      });
    },
  },

  components: {
    VForm: require('./../../../../components/form/form.vue'),
    VMessage: require('./../../../../components/form/message/message.vue'),
    VProductsTable: require('./../../../../components/orderProductsTable/orderProductsTable.vue'),
    VCreditNoteTable: require('./../../../../components/creditNoteProductsTable/creditNoteProductsTable.vue'),
  },
};

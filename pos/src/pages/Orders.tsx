import React, { useEffect, useRef, useState } from 'react';
import { Clock, User, UserCheck, Receipt, Printer, Pencil, X, MapPin } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { showToast } from '../components/ui/toast';
import OrderStatusSidebar from '../components/OrderStatusSidebar';
import { useRootStore } from '../store/root-store';
import { formatCurrency } from '../lib/utils';
import { Spinner } from '../components/ui/spinner';
import { Textarea } from '../components/ui/textarea';
import { usePOSStore } from '../store/pos-store';
import { useNavigate } from 'react-router-dom';
import PaymentDialog from '../components/PaymentDialog';
import { printOrder } from '../lib/print';
import { call } from '../lib/frappe-sdk';
import QRCode from 'qrcode';

export default function Orders() {
  const { 
    orders,
    orderLoading,
    error,
    selectedStatus,
    pagination,
    selectedOrder,
    selectedOrderItems,
    selectedOrderTaxes,
    selectedOrderLoading,
    selectedOrderError,
    fetchOrders,
    setSelectedStatus,
    goToNextPage,
    goToPreviousPage,
    selectOrder,
    clearSelectedOrder,
    orderSearchQuery
  } = useRootStore();

  const posStore = usePOSStore();
  const navigate = useNavigate();
  const mounted = useRef(false);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelLoading, setCancelLoading] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isPrintingAddress, setIsPrintingAddress] = useState(false);
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showAddressDialog, setShowAddressDialog] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return; // Skip the first run
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSearchQuery]);

  // Fetch customer address when order is selected
  useEffect(() => {
    if (selectedOrder?.customer) {
      fetchCustomerDetails(selectedOrder.customer);
    } else {
      setCustomerAddress('');
      setCustomerPhone('');
    }
  }, [selectedOrder]);

  // Fetch customer details (address and phone)
  async function fetchCustomerDetails(customerId: string) {
    try {
      const response = await fetch(`/api/resource/Customer/${customerId}`, {
        headers: {
          'X-Frappe-CSRF-Token': (window as any).csrf_token || '',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch customer details');
      const data = await response.json();
      setCustomerAddress(data.data.custom_manzil || '');
      setCustomerPhone(data.data.mobile_no || data.data.mobile_number || '');
    } catch (error) {
      console.error('Error fetching customer details:', error);
      setCustomerAddress('');
      setCustomerPhone('');
    }
  }

  // Generate QR Code as Data URL
  async function generateQRCode(data: string): Promise<string> {
    try {
      const qrDataUrl = await QRCode.toDataURL(data, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'H',
      });
      return qrDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  }

  // Print customer address with QR code
  async function handlePrintAddress() {
    if (!selectedOrder || !customerAddress) {
      showToast.error('Customer address not available');
      return;
    }

    setIsPrintingAddress(true);
    try {
      // QR code contains only the address/location
      const qrData = customerAddress;

      // Generate QR code
      const qrCodeDataUrl = await generateQRCode(qrData);

      const printWindow = window.open('', '', 'width=400,height=600');
      if (!printWindow) {
        throw new Error('Failed to open print window');
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Address - ${selectedOrder.name}</title>
            <meta charset="utf-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body { 
                font-family: 'Courier New', monospace;
                padding: 8px;
                line-height: 1.3;
                width: 58mm;
                font-size: 11px;
              }
              .header {
                text-align: center;
                border-bottom: 1px dashed #000;
                padding-bottom: 6px;
                margin-bottom: 8px;
              }
              .title {
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 3px;
              }
              .order-info {
                font-size: 10px;
              }
              .customer-name {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 6px;
                text-align: center;
              }
              .info-row {
                margin-bottom: 6px;
                font-size: 10px;
              }
              .info-label {
                font-weight: bold;
                margin-bottom: 2px;
              }
              .info-content {
                word-wrap: break-word;
                white-space: pre-wrap;
              }
              .qr-section {
                text-align: center;
                margin: 10px 0;
                padding: 8px 0;
                border-top: 1px dashed #000;
                border-bottom: 1px dashed #000;
              }
              .qr-code img {
                width: 120px;
                height: 120px;
                display: inline-block;
              }
              .qr-label {
                font-size: 9px;
                margin-top: 4px;
              }
              .footer {
                margin-top: 8px;
                padding-top: 6px;
                border-top: 1px dashed #000;
                font-size: 9px;
                text-align: center;
              }
              .no-print {
                margin-top: 15px;
                text-align: center;
              }
              .no-print button {
                padding: 8px 15px;
                margin: 0 3px;
                font-size: 12px;
                cursor: pointer;
                border: 1px solid #333;
                border-radius: 3px;
                background: #fff;
              }
              .no-print button:hover {
                background: #f0f0f0;
              }
              .no-print button.primary {
                background: #000;
                color: white;
              }
              @media print {
                body { 
                  padding: 0;
                  margin: 0;
                }
                .no-print { 
                  display: none !important; 
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">DELIVERY INFO</div>
              <div class="order-info">${selectedOrder.name}</div>
            </div>
            
            <div class="customer-name">${(selectedOrder as any).customer_name || selectedOrder.customer}</div>
            
            ${customerPhone ? `
            <div class="info-row">
              <div class="info-label">Tel:</div>
              <div class="info-content">${customerPhone}</div>
            </div>
            ` : ''}

            <div class="info-row">
              <div class="info-label">Address:</div>
              <div class="info-content">${customerAddress}</div>
            </div>

            <div class="qr-section">
              <div class="qr-code">
                <img src="${qrCodeDataUrl}" alt="QR Code" />
              </div>
              <div class="qr-label">Location QR Code</div>
            </div>

            <div class="footer">
              ${new Date().toLocaleString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: '2-digit',
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>

            <div class="no-print">
              <button class="primary" onclick="window.print()">Print</button>
              <button onclick="window.close()">Close</button>
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();
      showToast.success('Address print/save dialog opened');
    } catch (error: any) {
      showToast.error('Failed to generate address: ' + (error?.message || 'Unknown error'));
      console.error('Print address error:', error);
    } finally {
      setIsPrintingAddress(false);
    }
  }

  // Show address dialog instead of direct print
  function handleShowAddressDialog() {
    if (!customerAddress) {
      showToast.error('Customer address not available');
      return;
    }
    setShowAddressDialog(true);
  }

  // Function to format the date and time
  const formatDateTime = (date: string, time: string) => {
    const formattedDate = new Date(date + ' ' + time).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
    return formattedDate;
  };

  const handleOrderClick = (order: any) => {
    selectOrder(order);
  };

  // Helper function to get badge variant based on order status
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'Draft':
      case 'Unbilled':
        return 'secondary';
      case 'Recently Paid':
      case 'Paid':
      case 'Consolidated':
        return 'default';
      case 'Return':
        return 'destructive';
      default:
        return 'default';
    }
  };

  async function handleCancelOrder() {
    if (!selectedOrder) return;
    if (!cancelReason.trim()) {
      showToast.error('Please enter a reason for cancellation.');
      return;
    }
    setCancelLoading(true);
    try {
      await call.post('ury.ury.doctype.ury_order.ury_order.cancel_order', {
        invoice_id: selectedOrder.name,
        reason: cancelReason
      })
      showToast.success('Order cancelled successfully');
      setCancelDialogOpen(false);
      setCancelReason('');
      clearSelectedOrder();
      fetchOrders();
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setCancelLoading(false);
    }
  }

  async function handleEditOrder() {
    if (!selectedOrder) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/method/frappe.client.get?doctype=POS+Invoice&name=${selectedOrder.name}`);
      if (!res.ok) throw new Error('Failed to fetch order details');
      const data = await res.json();
      const order = data.message;
      // Fill POS store
      posStore.resetOrderState();
      posStore.setSelectedOrderType(order.order_type);
      posStore.setOrderForUpdate(order.name);
      if (order.restaurant_table) {
        posStore.setSelectedTable(order.restaurant_table, order.custom_restaurant_room || null,true);
      }
      posStore.setSelectedCustomer({ id: order.customer, name: order.customer_name, phone: order.mobile_number });
      // Fill cart
      const items = (order.items || []).map((item: any) => ({
        id: item.item_code,
        name: item.item_name,
        price: item.rate,
        quantity: item.qty,
        amount: item.amount,
        image: item.image || null,
        uniqueId: item.name,
        item: item.item_code,
        item_name: item.item_name,
        item_image: null,
        course: '',
        description: item.description || '',
        special_dish: 0,
        tax_rate: 0,
      }));
      for (const cartItem of items) {
        await posStore.addToOrder(cartItem);
      }
      // Redirect to POS page
      navigate('/');
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : 'Failed to edit order');
    } finally {
      setEditLoading(false);
    }
  }

  async function handlePrintOrder() {
    if (!selectedOrder || !posStore.posProfile) return;
    setIsPrinting(true);
    try {
      await printOrder({
        orderId: selectedOrder.name,
        posProfile: posStore.posProfile
      });
      showToast.success(`Printed Successfully`);
      // Locally update selectedOrder.invoice_printed to 1
      if (selectedOrder && typeof selectedOrder === 'object') {
        selectOrder({ ...selectedOrder, invoice_printed: 1 });
      }
      // If order was Unbilled, set to Draft and reload draft orders
      if (selectedStatus === 'Unbilled') {
        showToast.info('Order moved to Draft after printing.');
        setSelectedStatus('Draft');
        fetchOrders();
      }
    } catch (err: any) {
      showToast.error('Print failed: ' + (err?.message || err));
    } finally {
      setIsPrinting(false);
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-xl font-semibold text-red-600 mb-2">Failed to load orders</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Order Types */}
      <OrderStatusSidebar
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
      />

      {/* Middle Section - Order Cards */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden pr-96">
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 pb-40">
          {orderLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center mt-10">
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-screen-xl mx-auto">
              {orders.map((order) => (
                <Card 
                  key={order.name} 
                  className={`p-0 bg-white hover:shadow-md transition-shadow flex flex-col overflow-hidden cursor-pointer ${
                    selectedOrder?.name === order.name ? 'ring-2 ring-blue-500 shadow-lg' : ''
                  }`}
                  onClick={() => handleOrderClick(order)}
                >
                  <CardContent className="p-0 flex flex-col h-full">
                    <div className="p-3 bg-gray-50 border-b">
                    <h3 className="font-medium text-gray-900 text-sm truncate" title={order.name}>
                      {order.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">
                          {order.restaurant_table ? `Table ${order.restaurant_table} • ` : ''}{order.order_type}
                        </p>
                      </div>
                      <Badge variant={getBadgeVariant(order.status)} className="ml-2">
                        {order.status}
                      </Badge>
                    </div>
                    </div>

                    {/* Content section - matches MenuCard padding and structure */}
                    <div className="flex-1 p-3 flex flex-col">
                      <div className="">
                        <p className="text-sm text-gray-900">{order.customer}</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDateTime(order.posting_date, order.posting_time)}</span>
                      </div>

                      {/* Total - pushed to bottom like MenuCard */}
                      <div className="mt-auto pt-2">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {formatCurrency(order.rounded_total)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {/* Pagination Controls */}
          {!orderLoading && (
            <div className="py-4">
              <div className="flex justify-center items-center gap-x-4 max-w-screen-xl mx-auto">
                <Button
                  onClick={goToPreviousPage}
                  disabled={pagination.currentPage === 1}
                  variant="outline"
                  className='w-20'
                  size="xs"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.currentPage}
                  </span>
                </div>
                <Button
                  onClick={goToNextPage}
                  disabled={!pagination.hasNextPage}
                  variant="outline"
                  className='w-20'
                  size="xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Section - Order Details */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-[calc(100vh-4rem)] fixed right-0 z-10">
        {!selectedOrder ? (
          <div className="text-center h-full flex flex-col items-center justify-center text-gray-500 p-6">
            <p className="text-lg font-medium mb-2">Select an order to view details</p>
            <p className="text-sm">Click on any order card to view its details</p>
          </div>
        ) : selectedOrderLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : selectedOrderError ? (
          <div className="text-center h-full flex flex-col items-center justify-center text-red-500 p-6">
            <p className="text-lg font-medium mb-2">Failed to load order details</p>
            <p className="text-sm">{selectedOrderError}</p>
          </div>
        ) : (
          <>
            {/* Fixed Header */}
            <div className="sticky top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between min-h-[64px]">
              <h2 className="text-xl font-semibold text-gray-900 truncate max-w-[10rem]">{selectedOrder.name}</h2>
              <div className="flex items-center gap-2">
                {/* Only show edit and cancel buttons for Draft, Unbilled, and Recently Paid orders */}
                {(selectedOrder.status === 'Draft' || selectedOrder.status === 'Unbilled' || selectedOrder.status === 'Recently Paid') && (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Edit order"
                      onClick={handleEditOrder}
                      disabled={editLoading}
                    >
                      <Pencil className="w-4 h-4" />
                      {editLoading && <span className="ml-2 text-xs">Loading...</span>}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-md p-2 bg-gray-100 hover:bg-gray-200 text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Cancel order"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
                <Badge variant={getBadgeVariant(selectedOrder.status)}>
                  {selectedOrder.status}
                </Badge>
              </div>
            </div>
            {/* Cancel Order Dialog */}
            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Order</DialogTitle>
                  <DialogDescription>
                    Please provide a reason for cancelling this order.
                  </DialogDescription>
                </DialogHeader>
                <div className="px-6 mb-3">
                <Textarea
                  placeholder="Enter cancel reason"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  disabled={cancelLoading}
                  autoFocus
                />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>
                    Close
                  </Button>
                  <Button variant="danger" onClick={handleCancelOrder} disabled={cancelLoading}>
                    {cancelLoading ? 'Cancelling...' : 'Confirm Cancel'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Address Dialog */}
            <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Customer Delivery Address</DialogTitle>
                  <DialogDescription>
                    Choose to print or save the address with QR code
                  </DialogDescription>
                </DialogHeader>
                <div className="px-6 mb-3">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Customer Name:</p>
                      <p className="text-base text-gray-900">{(selectedOrder as any).customer_name || selectedOrder.customer}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Phone:</p>
                      <p className="text-base text-gray-900">{customerPhone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Address:</p>
                      <p className="text-base text-gray-900 whitespace-pre-wrap">{customerAddress}</p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddressDialog(false)}
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowAddressDialog(false);
                      handlePrintAddress();
                    }}
                    disabled={isPrintingAddress}
                  >
                    {isPrintingAddress ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" hideMessage />
                        Loading...
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4 mr-2" />
                        Open Print/Save
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 pb-40">
              {/* Order Header (now only info, not name/buttons) */}
              <div className="mb-6">
                {/* Two-column Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  {/* First column: customer and time */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-900 font-medium">{selectedOrder.customer}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{formatDateTime(selectedOrder.posting_date, selectedOrder.posting_time)}</span>
                    </div>
                  </div>
                  {/* Second column: waiter and table */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <UserCheck className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600">{selectedOrder.waiter}</span>
                    </div>
                    {selectedOrder.restaurant_table && (
                      <div className="flex items-center gap-3 text-sm">
                        <Receipt className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{selectedOrder.restaurant_table}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Address Display */}
                {customerAddress && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Delivery Address:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{customerAddress}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrderItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Taxes */}
              {selectedOrderTaxes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Taxes & Charges</h3>
                  <div className="space-y-2">
                    {selectedOrderTaxes.map((tax, index) => (
                      <div key={index} className="flex justify-between items-center py-1">
                        <span className="text-sm text-gray-600">{tax.description}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(tax.rate)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Section */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 sticky bottom-0 left-0 right-0 z-10">
              <div className="flex items-center gap-3 w-full">
                {/* Print Address Icon Button */}
                {customerAddress && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={handleShowAddressDialog}
                    aria-label="Print/Save Address"
                    disabled={isPrintingAddress}
                    title="Print or Save Delivery Address"
                  >
                    <MapPin className="w-5 h-5" />
                  </Button>
                )}
                {/* Print Invoice Icon Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={handlePrintOrder}
                  aria-label="Print Invoice"
                  disabled={isPrinting}
                  title="Print Invoice"
                >
                  {isPrinting ? <Spinner className="w-5 h-5" hideMessage /> : <Printer className="w-5 h-5" />}
                </Button>
                {/* Payment Button */}
                {(selectedOrder.status === 'Draft' || selectedOrder.status === 'Unbilled' || selectedOrder.status === 'Recently Paid') && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (String(selectedOrder.invoice_printed) === '0') {
                        showToast.error('Please print invoice before making payment');
                        return;
                      }
                      setShowPaymentDialog(true);
                    }}
                  >
                    Payment
                  </Button>
                )}
                {/* Total */}
                <span className="ml-auto text-xl font-bold text-gray-900 whitespace-nowrap">
                  {formatCurrency(selectedOrder.rounded_total)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
      {showPaymentDialog && selectedOrder && (
        <PaymentDialog
          onClose={() => setShowPaymentDialog(false)}
          grandTotal={selectedOrder.grand_total}
          roundedTotal={selectedOrder.rounded_total}
          invoice={selectedOrder.name}
          customer={selectedOrder.customer}
          posProfile={posStore.posProfile?.name || ''}
          table={selectedOrder.restaurant_table || null}
          cashier={posStore.posProfile?.cashier || ''}
          owner={posStore.posProfile?.cashier || ''}
          fetchOrders={fetchOrders}
          clearSelectedOrder={clearSelectedOrder}
        />
      )}
    </div>
  );
};

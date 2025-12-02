# Copyright (c) 2025, Tridz Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt, get_datetime, nowdate, nowtime, now_datetime
from frappe.model.document import Document


class URYWaiterClosing(Document):
	"""URY Waiter Closing Entry - Shift closing for waiters
	
	Simplified version - waiters don't handle cash/payments.
	This just tracks orders completed during the shift.
	"""
	
	def validate(self):
		self.posting_date = self.posting_date or nowdate()
		self.posting_time = self.posting_time or nowtime()
		
		self.validate_waiter_opening()
		self.load_shift_orders()
	
	def validate_waiter_opening(self):
		"""Validate that opening entry exists and is open"""
		if not self.waiter_opening:
			frappe.throw(_("Waiter Opening Entry is required"))
		
		opening = frappe.get_doc("URY Waiter Opening", self.waiter_opening)
		
		if opening.status != "Open":
			frappe.throw(
				_("Selected Waiter Opening Entry should be open. Current status: {0}").format(
					opening.status
				),
				title=_("Invalid Opening Entry")
			)
		
		if opening.docstatus != 1:
			frappe.throw(
				_("Waiter Opening Entry must be submitted"),
				title=_("Invalid Opening Entry")
			)
	
	def load_shift_orders(self):
		"""Load all orders from the shift and calculate totals"""
		# Get all invoices for this shift
		invoices = get_pos_invoices(
			self.period_start_date,
			self.period_end_date,
			self.pos_profile,
			self.user,
		)
		
		# Clear existing and populate fresh
		self.pos_transactions = []
		self.taxes = []
		
		self.grand_total = 0
		self.net_total = 0
		self.total_quantity = 0
		self.total_orders = len(invoices)
		
		taxes_dict = {}
		
		for inv in invoices:
			# Add invoice to transactions
			self.append("pos_transactions", {
				"pos_invoice": inv.name,
				"posting_date": inv.posting_date,
				"grand_total": inv.grand_total,
				"customer": inv.customer,
			})
			
			# Calculate totals
			self.grand_total += flt(inv.grand_total)
			self.net_total += flt(inv.net_total)
			self.total_quantity += flt(inv.total_qty)
			
			# Aggregate taxes
			for t in inv.taxes:
				key = (t.account_head, t.rate)
				if key in taxes_dict:
					taxes_dict[key]["amount"] += flt(t.tax_amount)
				else:
					taxes_dict[key] = {
						"account_head": t.account_head,
						"rate": t.rate,
						"amount": flt(t.tax_amount)
					}
		
		# Add taxes
		for tax_data in taxes_dict.values():
			self.append("taxes", tax_data)
	
	def on_submit(self):
		self.db_set('status', 'Submitted', update_modified=False)
		self.update_opening_entry()
	
	def update_opening_entry(self):
		"""Update opening entry to Closed status"""
		opening = frappe.get_doc("URY Waiter Opening", self.waiter_opening)
		opening.db_set('status', 'Closed', update_modified=False)
		opening.db_set('waiter_closing', self.name, update_modified=False)
		opening.db_set('period_end_date', self.period_end_date, update_modified=False)


@frappe.whitelist()
def get_pos_invoices(start, end, pos_profile, user):
	"""Get all POS invoices for the shift period"""
	data = frappe.db.sql(
		"""
		SELECT
			name, timestamp(posting_date, posting_time) as "timestamp"
		FROM
			`tabPOS Invoice`
		WHERE
			owner = %s AND docstatus = 1 AND pos_profile = %s 
			AND ifnull(consolidated_invoice,'') = ''
		""",
		(user, pos_profile),
		as_dict=1,
	)
	
	# Filter by date range
	data = list(
		filter(
			lambda d: get_datetime(start) <= get_datetime(d.timestamp) <= get_datetime(end),
			data
		)
	)
	
	# Get full invoice data for taxes
	data = [frappe.get_doc("POS Invoice", d.name).as_dict() for d in data]
	
	return data


@frappe.whitelist()
def make_closing_entry_from_opening(waiter_opening):
	"""Create closing entry from opening entry"""
	opening = frappe.get_doc("URY Waiter Opening", waiter_opening)
	
	if opening.status != "Open":
		frappe.throw(_("Waiter Opening Entry is not open"))
	
	return {
		"waiter_opening": opening.name,
		"period_start_date": opening.period_start_date,
		"period_end_date": now_datetime(),
		"pos_profile": opening.pos_profile,
		"user": opening.user,
		"company": opening.company,
		"waiter_profile": opening.waiter_profile if hasattr(opening, 'waiter_profile') else None
	}


@frappe.whitelist()
def close_waiter_shift(waiter_opening):
	"""API to close a waiter shift"""
	closing = make_closing_entry_from_opening(waiter_opening)
	closing.insert(ignore_permissions=True)
	closing.submit()
	
	return closing.as_dict()

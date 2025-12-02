# Copyright (c) 2025, Tridz Technologies and contributors
# Waiter Shift Validation APIs
# This module provides centralized shift validation for all waiter operations

import frappe
from frappe import _
from frappe.utils import now_datetime


class WaiterShiftError(frappe.ValidationError):
	"""Custom exception for shift-related errors"""
	http_status_code = 403


def get_current_waiter_opening(user=None):
	"""
	Get the current open shift for a waiter.
	Returns dict with opening details or None if no open shift.
	"""
	if not user:
		user = frappe.session.user
	
	opening = frappe.db.get_value(
		"URY Waiter Opening",
		{
			"user": user,
			"status": "Open",
			"docstatus": 1
		},
		["name", "period_start_date", "pos_profile", "company"],
		as_dict=True
	)
	
	return opening


def validate_waiter_shift(user=None, throw=True):
	"""
	Validate that waiter has an open shift.
	This should be called before any operation (order, table, payment).
	
	Args:
		user: User to check (defaults to current session user)
		throw: If True, throw error; if False, return status dict
	
	Returns:
		dict with shift status and details
	"""
	if not user:
		user = frappe.session.user
	
	opening = get_current_waiter_opening(user)
	
	if not opening:
		if throw:
			frappe.throw(
				_("No open shift found. Please open a shift before performing any operations."),
				WaiterShiftError,
				title=_("Shift Required")
			)
		return {
			"valid": False,
			"has_open_shift": False,
			"message": _("No open shift found. Please open a shift first.")
		}
	
	return {
		"valid": True,
		"has_open_shift": True,
		"opening_entry": opening.name,
		"pos_profile": opening.pos_profile,
		"company": opening.company,
		"period_start_date": opening.period_start_date
	}


@frappe.whitelist()
def check_shift_status(user=None):
	"""
	API endpoint to check waiter shift status.
	Used by frontend before allowing any operation.
	"""
	return validate_waiter_shift(user, throw=False)


@frappe.whitelist()
def validate_before_order():
	"""
	Validate shift before creating/modifying an order.
	Called from URY KOT and related documents.
	"""
	result = validate_waiter_shift(throw=False)
	
	if not result["valid"]:
		return {
			"allowed": False,
			"message": result["message"],
			"redirect": "/app/ury-waiter-opening/new-ury-waiter-opening-1"
		}
	
	return {
		"allowed": True,
		"opening_entry": result["opening_entry"],
		"pos_profile": result["pos_profile"],
		"company": result["company"]
	}


@frappe.whitelist()
def validate_before_table_operation():
	"""
	Validate shift before any table management operation.
	"""
	return validate_before_order()


@frappe.whitelist()
def validate_before_payment():
	"""
	Validate shift before processing any payment.
	"""
	return validate_before_order()


@frappe.whitelist()
def get_shift_summary(user=None):
	"""
	Get summary of current shift including orders and payments.
	"""
	if not user:
		user = frappe.session.user
	
	opening = get_current_waiter_opening(user)
	
	if not opening:
		return {
			"has_open_shift": False,
			"message": _("No open shift found")
		}
	
	# Get orders count
	orders = frappe.db.count("POS Invoice", {
		"owner": user,
		"docstatus": 1,
		"posting_date": [">=", opening.period_start_date.date()],
		"pos_profile": opening.pos_profile
	})
	
	# Get total sales
	total_sales = frappe.db.sql("""
		SELECT COALESCE(SUM(grand_total), 0) as total
		FROM `tabPOS Invoice`
		WHERE owner = %s 
		AND docstatus = 1 
		AND pos_profile = %s
		AND timestamp(posting_date, posting_time) >= %s
	""", (user, opening.pos_profile, opening.period_start_date), as_dict=True)
	
	return {
		"has_open_shift": True,
		"opening_entry": opening.name,
		"period_start_date": opening.period_start_date,
		"total_orders": orders,
		"total_sales": total_sales[0].total if total_sales else 0,
		"shift_duration": frappe.utils.time_diff_in_hours(now_datetime(), opening.period_start_date)
	}


# Hook functions to be called from other documents
def on_kot_validate(doc, method):
	"""Hook: Validate shift before KOT creation"""
	if doc.is_new():
		validate_waiter_shift(doc.user if hasattr(doc, 'user') else None)


def on_pos_invoice_validate(doc, method):
	"""Hook: Validate shift before POS Invoice creation"""
	if doc.is_new():
		validate_waiter_shift(doc.owner)


def on_table_order_validate(doc, method):
	"""Hook: Validate shift before table order creation"""
	if doc.is_new():
		validate_waiter_shift()

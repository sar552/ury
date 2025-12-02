# Copyright (c) 2025, Tridz Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import cint, nowdate, now_datetime
from frappe.model.document import Document


class URYWaiterOpening(Document):
	"""URY Waiter Opening Entry - Simple shift tracking for waiters
	
	Waiters don't handle cash/payments, they only take orders.
	This is a simplified version without balance tracking.
	"""
	
	def validate(self):
		self.validate_waiter_profile_and_user()
		self.validate_existing_open_shift()
		self.set_pos_profile_from_waiter_profile()
	
	def validate_waiter_profile_and_user(self):
		"""Validate Waiter Profile belongs to company and user is enabled"""
		if not self.waiter_profile:
			frappe.throw(_("Waiter Profile is required"))
		
		profile = frappe.get_doc("URY Waiter Profile", self.waiter_profile)
		
		if profile.disabled:
			frappe.throw(_("Waiter Profile {0} is disabled").format(self.waiter_profile))
		
		if self.company != profile.company:
			frappe.throw(
				_("Waiter Profile {} does not belong to company {}").format(self.waiter_profile, self.company)
			)
		
		if not cint(frappe.db.get_value("User", self.user, "enabled")):
			frappe.throw(_("User {} is disabled. Please select a valid user").format(self.user))
	
	def set_pos_profile_from_waiter_profile(self):
		"""Set POS Profile from Waiter Profile for backward compatibility"""
		if self.waiter_profile and not self.pos_profile:
			profile = frappe.get_doc("URY Waiter Profile", self.waiter_profile)
			# Find POS Profile for the same branch and company
			pos_profile = frappe.db.get_value("POS Profile", {
				"branch": profile.branch,
				"company": profile.company
			}, "name")
			if pos_profile:
				self.pos_profile = pos_profile
	
	def validate_existing_open_shift(self):
		"""Ensure user doesn't have another open shift"""
		if self.is_new() or self.docstatus == 0:
			existing = frappe.db.exists("URY Waiter Opening", {
				"user": self.user,
				"status": "Open",
				"docstatus": 1,
				"name": ["!=", self.name or ""]
			})
			if existing:
				frappe.throw(
					_("User {0} already has an open shift: {1}. Please close it first.").format(
						self.user, existing
					)
				)
	
	def on_submit(self):
		self.db_set('status', 'Open', update_modified=False)


@frappe.whitelist()
def get_current_waiter_opening(user=None):
	"""Get current open shift for waiter"""
	if not user:
		user = frappe.session.user
	
	opening = frappe.db.get_value("URY Waiter Opening", {
		"user": user,
		"status": "Open",
		"docstatus": 1
	}, ["name", "period_start_date", "waiter_profile", "company"], as_dict=1)
	
	return opening


@frappe.whitelist()
def check_waiter_shift_status(user=None):
	"""Check if waiter has an open shift - used for validation before any operation"""
	if not user:
		user = frappe.session.user
	
	opening = get_current_waiter_opening(user)
	
	if not opening:
		return {
			"has_open_shift": False,
			"message": _("No open shift found. Please open a shift first.")
		}
	
	return {
		"has_open_shift": True,
		"opening_entry": opening.name,
		"waiter_profile": opening.waiter_profile,
		"period_start_date": opening.period_start_date
	}


@frappe.whitelist()
def create_waiter_opening(waiter_profile):
	"""API to create a new waiter opening entry
	
	Simplified version - no balance tracking needed for waiters
	"""
	user = frappe.session.user
	
	# Check for existing open shift
	existing = get_current_waiter_opening(user)
	if existing:
		frappe.throw(
			_("You already have an open shift: {0}. Please close it first.").format(existing.name)
		)
	
	# Get Waiter Profile details
	profile = frappe.get_doc("URY Waiter Profile", waiter_profile)
	
	# Create opening entry
	opening = frappe.new_doc("URY Waiter Opening")
	opening.waiter_profile = waiter_profile
	opening.company = profile.company
	opening.user = user
	opening.posting_date = nowdate()
	opening.period_start_date = now_datetime()
	
	opening.insert(ignore_permissions=True)
	opening.submit()
	
	return opening.as_dict()


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_waiter_users(doctype, txt, searchfield, start, page_len, filters):
	"""Get users who have URY Waiter Profile linked"""
	waiter_profile = filters.get('waiter_profile')
	
	if waiter_profile:
		# Get users from specific waiter profile
		waiter_users = frappe.db.sql("""
			SELECT u.name, u.full_name
			FROM `tabUser` u
			INNER JOIN `tabURY Waiter Profile User` wpu ON wpu.user = u.name
			WHERE wpu.parent = %(waiter_profile)s
			AND u.enabled = 1
			AND (u.full_name LIKE %(txt)s OR u.name LIKE %(txt)s)
			ORDER BY u.full_name
			LIMIT %(start)s, %(page_len)s
		""", {
			'waiter_profile': waiter_profile,
			'txt': '%' + txt + '%',
			'start': start,
			'page_len': page_len
		})
	else:
		# Get all waiter users
		waiter_users = frappe.db.sql("""
			SELECT u.name, u.full_name
			FROM `tabUser` u
			INNER JOIN `tabURY Waiter Profile User` wpu ON wpu.user = u.name
			INNER JOIN `tabURY Waiter Profile` wp ON wp.name = wpu.parent
			WHERE u.enabled = 1
			AND wp.disabled = 0
			AND (u.full_name LIKE %(txt)s OR u.name LIKE %(txt)s)
			ORDER BY u.full_name
			LIMIT %(start)s, %(page_len)s
		""", {
			'txt': '%' + txt + '%',
			'start': start,
			'page_len': page_len
		})
	
	return waiter_users

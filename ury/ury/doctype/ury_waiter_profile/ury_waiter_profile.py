# Copyright (c) 2025, Tridz Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class URYWaiterProfile(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from ury.ury.doctype.ury_waiter_profile_user.ury_waiter_profile_user import URYWaiterProfileUser

		allow_discount_change: DF.Check
		allow_rate_change: DF.Check
		applicable_for_waiters: DF.Table[URYWaiterProfileUser]
		apply_discount_on: DF.Literal["Grand Total", "Net Total"]
		auto_add_item_to_cart: DF.Check
		auto_close_shift: DF.Check
		branch: DF.Link | None
		company: DF.Link
		cost_center: DF.Link | None
		currency: DF.Link
		customer: DF.Link | None
		customer_groups: DF.Table
		disabled: DF.Check
		enable_shift_management: DF.Check
		expense_account: DF.Link | None
		hide_images: DF.Check
		hide_unavailable_items: DF.Check
		ignore_pricing_rule: DF.Check
		income_account: DF.Link | None
		item_groups: DF.Table
		letter_head: DF.Link | None
		max_shift_duration: DF.Float
		print_format: DF.Link | None
		profile_name: DF.Data
		restaurant: DF.Link | None
		select_print_heading: DF.Link | None
		selling_price_list: DF.Link
		shift_end_time: DF.Time | None
		shift_start_time: DF.Time | None
		tax_category: DF.Link | None
		taxes_and_charges: DF.Link | None
		tc_name: DF.Link | None
		territory: DF.Link | None
		update_stock: DF.Check
		validate_stock_on_save: DF.Check
		warehouse: DF.Link
	# end: auto-generated types

	def validate(self):
		self.validate_default_profile()
		self.validate_currency()

	def validate_default_profile(self):
		"""Ensure only one default profile per user"""
		for user in self.applicable_for_waiters:
			if user.default:
				# Check if another profile has this user as default
				exists = frappe.db.sql("""
					SELECT parent
					FROM `tabURY Waiter Profile User`
					WHERE user = %s AND `default` = 1 AND parent != %s
				""", (user.user, self.name))
				
				if exists:
					frappe.throw(_("User {0} is already set as default in profile {1}").format(
						user.user, exists[0][0]
					))

	def validate_currency(self):
		"""Validate currency matches company currency"""
		if self.company:
			company_currency = frappe.db.get_value("Company", self.company, "default_currency")
			if self.currency != company_currency:
				frappe.msgprint(_("Currency {0} does not match company currency {1}").format(
					self.currency, company_currency
				), alert=True)


@frappe.whitelist()
def get_waiter_profile(user=None):
	"""Get default waiter profile for user"""
	if not user:
		user = frappe.session.user
	
	# Check for default profile
	profile = frappe.db.sql("""
		SELECT parent
		FROM `tabURY Waiter Profile User`
		WHERE user = %s AND `default` = 1
		LIMIT 1
	""", user)
	
	if profile:
		return frappe.get_doc("URY Waiter Profile", profile[0][0])
	
	# Get any profile user has access to
	profile = frappe.db.sql("""
		SELECT parent
		FROM `tabURY Waiter Profile User`
		WHERE user = %s
		LIMIT 1
	""", user)
	
	if profile:
		return frappe.get_doc("URY Waiter Profile", profile[0][0])
	
	return None


@frappe.whitelist()
def get_applicable_profiles(user=None):
	"""Get all profiles applicable for user"""
	if not user:
		user = frappe.session.user
	
	profiles = frappe.db.sql("""
		SELECT DISTINCT parent
		FROM `tabURY Waiter Profile User`
		WHERE user = %s
	""", user, as_dict=1)
	
	return [p.parent for p in profiles]

import json
import re

import frappe
import frappe.sessions
from frappe import _
from frappe.utils.telemetry import capture

no_cache = 1

SCRIPT_TAG_PATTERN = re.compile(r"\<script[^<]*\</script\>")
CLOSING_SCRIPT_TAG_PATTERN = re.compile(r"</script\>")


def get_context(context):
	csrf_token = frappe.sessions.get_csrf_token()
	# Manually commit the CSRF token here
	frappe.db.commit()  # nosemgrep

	if frappe.session.user == "Guest":
		boot = frappe.website.utils.get_boot_data()
	else:
		try:
			boot = frappe.sessions.get()
		except Exception as e:
			raise frappe.SessionBootFailed from e
	
	# Check if user has URY Waiter role and waiter opening AFTER getting boot
	user_roles = frappe.get_roles()
	is_waiter = "URY waiter" in user_roles

	# Debug logging
	frappe.logger().info(f"POS Access - User: {frappe.session.user}, Roles: {user_roles}, Is Waiter: {is_waiter}")

	if is_waiter:
		# Check if waiter has open shift
		waiter_opening = frappe.db.get_value(
			"URY Waiter Opening",
			{
				"user": frappe.session.user,
				"status": "Open",
				"docstatus": 1
			},
			"name"
		)

		frappe.logger().info(f"Waiter Opening Check - User: {frappe.session.user}, Opening: {waiter_opening}")

		if not waiter_opening:
			frappe.local.flags.redirect_location = "/app/ury-waiter-opening"
			raise frappe.Redirect

	# add server_script_enabled in boot
	if "server_script_enabled" in frappe.conf:
		enabled = frappe.conf.server_script_enabled
	else:
		enabled = True
	boot["server_script_enabled"] = enabled

	boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
	boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)

	boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = json.dumps(boot_json)

	context.update(
		{"build_version": frappe.utils.get_build_version(), "boot": boot_json, "csrf_token": csrf_token}
	)
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(_("This method is only meant for developer mode"))
	return json.loads(get_boot())


def get_boot():
	try:
		boot = frappe.sessions.get()
	except Exception as e:
		raise frappe.SessionBootFailed from e

	boot["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")
	boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
	boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)

	boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = json.dumps(boot_json)

	return boot_json


def has_website_permission(doc, ptype, user, verbose=False):
	"""Custom permission check for POS page access"""
	# Allow all logged in users with System User type
	if frappe.session.user != "Guest":
		return True
	return False

// Copyright (c) 2025, Tridz Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('URY Waiter Opening', {
setup: function(frm) {
frm.set_query('waiter_profile', function() {
return {
filters: {
company: frm.doc.company,
disabled: 0
}
};
});

// Filter users who have URY Waiter Profile
frm.set_query('user', function() {
return {
query: 'ury.ury.doctype.ury_waiter_opening.ury_waiter_opening.get_waiter_users',
filters: {
waiter_profile: frm.doc.waiter_profile
}
};
});
},

onload: function(frm) {
// If coming from URY Waiter Profile via Connection, load profile data
if (frm.is_new() && frm.doc.waiter_profile) {
frm.trigger('waiter_profile');
}

// Clear user if it was auto-filled but user is not a waiter
if (frm.is_new() && frm.doc.user && !frm.doc.waiter_profile) {
// Check if current user is a waiter
frappe.call({
method: 'frappe.client.get_count',
args: {
doctype: 'URY Waiter Profile User',
filters: {
user: frm.doc.user
}
},
callback: function(r) {
if (!r.message || r.message === 0) {
// User is not a waiter, clear the field
frm.set_value('user', '');
}
}
});
}
},

refresh: function(frm) {
// Status indicators
if (frm.doc.status === 'Open') {
frm.page.set_indicator(__('Open'), 'blue');

// Add Close Shift button when submitted and status is Open
if (frm.doc.docstatus === 1) {
frm.add_custom_button(__('Close Shift'), function() {
frappe.set_route('Form', 'URY Waiter Closing', 'new-ury-waiter-closing-1');
}, __('Actions'));
}
} else if (frm.doc.status === 'Closed') {
frm.page.set_indicator(__('Closed'), 'green');
} else {
frm.page.set_indicator(__('Draft'), 'gray');
}
},

	waiter_profile: function(frm) {
		// Set company and applicable users from Waiter Profile
		if (frm.doc.waiter_profile) {
			frappe.call({
				method: 'frappe.client.get',
				args: {
					doctype: 'URY Waiter Profile',
					name: frm.doc.waiter_profile
				},
				callback: function(r) {
					if (r.message) {
						let profile = r.message;
						frm.set_value('company', profile.company);
						
						// Only set user if current user is in the applicable_for_waiters list
						if (profile.applicable_for_waiters && profile.applicable_for_waiters.length > 0) {
							let current_user = frappe.session.user;
							let found_user = profile.applicable_for_waiters.find(w => w.user === current_user);
							if (found_user) {
								frm.set_value('user', current_user);
							}
						}
					}
				}
			});
		}
	}
});
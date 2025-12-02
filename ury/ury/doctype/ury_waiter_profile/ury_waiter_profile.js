// Copyright (c) 2025, Tridz Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('URY Waiter Profile', {
	branch: function(frm) {
		// Clear restaurant when branch changes
		if (frm.doc.restaurant) {
			frm.set_value('restaurant', '');
		}
		
		// Set filter for restaurant based on branch
		frm.set_query('restaurant', function() {
			return {
				filters: {
					'branch': frm.doc.branch
				}
			};
		});
	},
	
	refresh: function(frm) {
		// Set restaurant filter on form load
		frm.set_query('restaurant', function() {
			return {
				filters: {
					'branch': frm.doc.branch
				}
			};
		});
	}
});

// Copyright (c) 2025, Tridz Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on('URY Waiter Closing', {
	setup: function(frm) {
		frm.set_query('waiter_opening', function() {
			return {
				filters: {
					status: 'Open',
					docstatus: 1,
					user: frappe.session.user
				}
			};
		});
	},
	
	refresh: function(frm) {
		// Status indicators
		if (frm.doc.status === 'Submitted') {
			frm.page.set_indicator(__('Submitted'), 'green');
		} else {
			frm.page.set_indicator(__('Draft'), 'gray');
		}
		
		// Show shift summary after submit
		if (frm.doc.docstatus === 1) {
			let summary = `
				<div class="alert alert-success">
					<h5>${__('Shift Summary')}</h5>
					<p><strong>${__('Total Orders')}:</strong> ${frm.doc.total_orders || 0}</p>
					<p><strong>${__('Grand Total')}:</strong> ${format_currency(frm.doc.grand_total, frm.doc.currency)}</p>
					<p><strong>${__('Net Total')}:</strong> ${format_currency(frm.doc.net_total, frm.doc.currency)}</p>
					<p><strong>${__('Total Quantity')}:</strong> ${frm.doc.total_quantity || 0}</p>
				</div>
			`;
			frm.set_intro(summary);
		}
	},
	
	waiter_opening: function(frm) {
		if (frm.doc.waiter_opening) {
			frappe.call({
				method: 'ury.ury.doctype.ury_waiter_closing.ury_waiter_closing.make_closing_entry_from_opening',
				args: {
					waiter_opening: frm.doc.waiter_opening
				},
				freeze: true,
				freeze_message: __('Loading shift data...'),
				callback: function(r) {
					if (r.message) {
						let data = r.message;
						
						// Set basic fields
						frm.set_value('period_start_date', data.period_start_date);
						frm.set_value('period_end_date', data.period_end_date);
						frm.set_value('pos_profile', data.pos_profile);
						frm.set_value('user', data.user);
						frm.set_value('company', data.company);
						
						frm.refresh_fields();
						frm.save();
					}
				}
			});
		}
	}
});

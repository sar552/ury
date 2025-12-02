frappe.ui.form.on('POS Closing Entry', {
    validate: function(frm) {
        // 1. Agar avval tasdiqlangan bo'lsa, tekshiruvni o'tkazib yuboramiz
        if (frm.custom_save_confirmed) {
            return;
        }

        // 2. Jarayonni vaqtincha to'xtatamiz
        validated = false;

        // 3. Tasdiqlash oynasini chiqaramiz
        frappe.confirm(
            'Kassadagi "Closing Amount" (Haqiqiy summa) ni kiritdingiz. Ma\'lumotlar to‘g‘riligiga ishonchingiz komilmi?',
            function() {
                // "Ha" bosilsa:
                frm.custom_save_confirmed = true; // Flag o'rnatamiz
                frm.save(); // Qayta saqlashni chaqiramiz
            },
            function() {
                // "Yo'q" bosilsa:
                frappe.msgprint('Saqlash bekor qilindi. Qayta tekshiring.');
                // validated = false holatida qoladi, hech narsa bo'lmaydi
            }
        );
    }
});
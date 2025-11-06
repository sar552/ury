import frappe


def before_insert(doc, event):
    validate_mobile_number(doc, event)
    set_default_customer_group_and_territory(doc, event)


def validate_mobile_number(doc, event):
    if not doc.mobile_number:
        frappe.throw("Mobile Number is Mandatory")


def set_default_customer_group_and_territory(doc, event):
    """
    Agar Customer Group yoki Territory bo'sh bo'lsa, default qiymatlarni o'rnatadi.
    POS Quick Entry Form'dan yaratilgan mijozlar uchun kerak.
    """
    # Agar Customer Group bo'sh bo'lsa, default qiymat o'rnatish
    if not doc.customer_group:
        # Avval "All Customer Groups" borligini tekshirish
        if frappe.db.exists("Customer Group", "All Customer Groups"):
            doc.customer_group = "All Customer Groups"
        elif frappe.db.exists("Customer Group", "Commercial"):
            doc.customer_group = "Commercial"
        else:
            # Birinchi Customer Group'ni olish
            first_group = frappe.db.get_value("Customer Group", {"is_group": 0}, "name")
            if first_group:
                doc.customer_group = first_group
            else:
                frappe.throw("Customer Group majburiy. Kamida bitta Customer Group yarating.")

    # Agar Territory bo'sh bo'lsa, default qiymat o'rnatish
    if not doc.territory:
        # Avval "All Territories" borligini tekshirish
        if frappe.db.exists("Territory", "All Territories"):
            doc.territory = "All Territories"
        elif frappe.db.exists("Territory", "Rest Of The World"):
            doc.territory = "Rest Of The World"
        else:
            # Birinchi Territory'ni olish
            first_territory = frappe.db.get_value("Territory", {"is_group": 0}, "name")
            if first_territory:
                doc.territory = first_territory
            else:
                frappe.throw("Territory majburiy. Kamida bitta Territory yarating.")

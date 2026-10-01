/*
@codescope
@title Store calculations with constants
@seed TAX_RATE min=0.05 max=0.12 decimals=2
@seed SHOP_NAME values="Tech Haven"|"Code Corner"|"Byte Market"
@seed MEMBER_DISCOUNT_YEARS min=1 max=5
@seed customerName values="Diego"|"Maria"|"Amina"
@seed yearsAsMember min=1 max=8
@seed itemPrice min=800.00 max=1500.00 decimals=2
@seed quantity min=1 max=5
*/
public class TaskSierra {
    public static void main(String[] args) {
        final double TAX_RATE = 0.08;
        final String SHOP_NAME = "Tech Haven";
        final int MEMBER_DISCOUNT_YEARS = 2;

        String customerName = "Diego";
        int yearsAsMember = 3;
        double itemPrice = 1200.25;
        int quantity = 2;

        System.out.println("Welcome to " + SHOP_NAME + "!");
        System.out.println("Customer: \"" + customerName + "\"");

        double subtotal = itemPrice * quantity;
        double discount = subtotal * 0.10;
        double taxedAmount = (subtotal - discount) * TAX_RATE;
        double finalTotal = subtotal - discount + taxedAmount;

        System.out.println("Quantity: " + quantity);
        System.out.println("Subtotal: " + subtotal);
        System.out.println("Is loyal member: " + (yearsAsMember >= MEMBER_DISCOUNT_YEARS));
        System.out.println("Discount: " + discount);
        System.out.println("Tax: " + taxedAmount);
        System.out.println("Final Total: " + finalTotal);
        System.out.println("Have a great day, " + customerName + "!");
    }
}

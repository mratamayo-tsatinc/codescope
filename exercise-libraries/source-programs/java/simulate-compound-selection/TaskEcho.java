/*
@codescope
@title Store Payment with Member Discount
@seed items min=3 max=7
@seed price min=100 max=140 step=10
@seed member values=true|false
@seed discount min=10 max=30 step=10
*/
public class TaskEcho
{
    public static void main(String[] args)
    {
        int items = 5, price = 120;
        boolean member = true;
        int subtotal, discount = 20, amountDue;

        subtotal = items * price + 2 * 10;

        if ((member && items >= 5) || (!member && subtotal >= 1000)) {
            discount = discount + 30;
        } else if (items > 2 && price >= 100) {
            discount = discount + 10;
        } else {
            discount = 0;
        }

        amountDue = subtotal - discount;

        System.out.println("=== SALES RECEIPT ===");
        
        if (member) {
            System.out.println("Customer   : MEMBER");
        } else {
            System.out.println("Customer   : REGULAR");
        }
        
        System.out.println("Items      : " + items);
        System.out.println("Subtotal   : " + subtotal);
        System.out.println("Discount   : -" + discount);
        System.out.println("Amount Due : " + amountDue);
    }
}

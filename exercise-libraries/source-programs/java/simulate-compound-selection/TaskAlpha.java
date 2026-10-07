/*
@codescope
@title Store Transaction
@seed itemCost min=430 max=470 step=10
@seed quantity min=2 max=4
*/
public class TaskAlpha
{
    public static void main(String[] args)
    {
        int itemCost = 450, quantity = 3, discount = 50;
        int subtotal, total;
        boolean canBuy;

        subtotal = itemCost * quantity + 20 * 2;
        canBuy = (quantity > 0 && subtotal >= 500) || !((itemCost < 100));

        if (canBuy && subtotal >= 1000) {
            discount = discount + 25;
        } else if (canBuy || quantity == 1) {
            discount = discount + 10;
        } else {
            discount = 0;
        }

        total = subtotal - discount;

        System.out.println("=== ORDER SUMMARY ===");
        System.out.println("Unit Price : " + itemCost);
        System.out.println("Quantity   : " + quantity);
        System.out.println("Subtotal   : " + subtotal);
        System.out.println("Discount   : " + discount);
        System.out.println("Total Due  : " + total);
        
        if (canBuy) {
            System.out.println("Status     : APPROVED");
        } else {
            System.out.println("Status     : DECLINED");
        }
    }
}

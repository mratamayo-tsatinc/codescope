/*
@codescope
@title Night Room Rate Calculation
@seed nights min=2 max=4
@seed roomRate min=550 max=750 step=50
@seed mealCost min=100 max=300 step=100
*/
public class TaskHotel
{
    public static void main(String[] args)
    {
        int nights = 3, roomRate = 650, mealCost = 300;
        int roomTotal, discount = 50, totalBill;
        boolean eligible;

        roomTotal = nights * roomRate + mealCost / 3 * 2;
        eligible = (nights >= 3 && roomRate >= 500) || (mealCost > 500 && !((nights < 2)));

        if (eligible && roomTotal >= 2000) {
            discount = discount + 50;
        } else if (eligible || nights == 1) {
            discount = discount + 50;
        } else {
            discount = 0;
        }
        
        totalBill = roomTotal + mealCost - discount;

        System.out.println("=== HOTEL BILL ===");
        System.out.println("Nights     : " + nights);
        System.out.println("Room Total : " + roomTotal);
        System.out.println("Meals      : " + mealCost);
        System.out.println("Discount   : -" + discount);
        System.out.println("Total Bill : " + totalBill);
        if (eligible) {
            System.out.println("Eligible   : YES");
        } else {
            System.out.println("Eligible   : NO");
        }
    }
}

/*
@codescope
@title Mixed Types with Scanner
@result total
@input target=quantity value=4 min=1 max=50 step=1
@input target=price value=19.5 min=1 max=500 step=0.5 decimals=2
@input target=size value='M' choices='S'|'M'|'L'
*/
import java.util.Scanner;

public class B04_MixedTypes {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int quantity;
        double price;
        char size;
        double total;

        System.out.print("Enter quantity, unit price and size letter: ");
        quantity = input.nextInt();
        price = input.nextDouble();
        size = input.next().charAt(0);
        total = quantity * price;
        System.out.println("Size: " + size);
        System.out.println("Total: " + total);
    }
}

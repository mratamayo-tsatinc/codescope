/*
@codescope
@title Multiple Integer Input
@result total
@input target=x value=4 min=1 max=20
@input target=y value=7 min=1 max=20
@input target=z value=2 min=1 max=20
*/
import java.util.Scanner;

public class MultipleIntegers {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int x;
        int y;
        int z;
        int total;

        System.out.print("Enter three integers: ");
        x = input.nextInt();
        y = input.nextInt();
        z = input.nextInt();
        total = x + y + z;
        System.out.println("Total: " + total);
    }
}

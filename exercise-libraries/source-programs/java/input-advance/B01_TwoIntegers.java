/*
@codescope
@title Two Integers with Scanner
@result y
@input target=x value=8 min=1 max=100 step=1
@input target=y value=15 min=1 max=100 step=1
*/
import java.util.Scanner;

public class B01_TwoIntegers {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int x;
        int y;

        System.out.print("Enter two integers: ");
        x = input.nextInt();
        y = input.nextInt();
        System.out.println("x = " + x + ", y = " + y);
    }
}

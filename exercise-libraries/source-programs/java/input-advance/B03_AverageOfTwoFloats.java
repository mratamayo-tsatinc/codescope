/*
@codescope
@title Average of Two Real Numbers
@result average
@input target=a value=7.5 min=0 max=100 step=0.5 decimals=2
@input target=b value=9.25 min=0 max=100 step=0.25 decimals=2
*/
import java.util.Scanner;

public class B03_AverageOfTwoFloats {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        double a;
        double b;
        double average;

        System.out.print("Enter two real numbers: ");
        a = input.nextDouble();
        b = input.nextDouble();
        average = (a + b) / 2.0;
        System.out.println("Average: " + average);
    }
}

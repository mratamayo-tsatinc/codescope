/*
@codescope
@title Integer and floating-point arithmetic
@seed a min=10 max=25
@seed b min=2 max=9
@seed x min=10.0 max=25.0 decimals=1
@seed y min=2.0 max=9.0 decimals=1
*/
public class TaskLima {
    public static void main(String[] args) {
        int a = 15;
        int b = 4;

        int sum = a + b;
        int diff = a - b;
        int product = a * b;
        int quotient = a / b;
        int remainder = a % b;

        double x = 15.0;
        double y = 4.0;
        double floatQuotient = x / y;

        System.out.println("a = " + a + ", b = " + b);
        System.out.println("Sum: " + sum);
        System.out.println("Difference: " + diff);
        System.out.println("Product: " + product);
        System.out.println("Integer Quotient: " + quotient);
        System.out.println("Remainder: " + remainder);
        System.out.println("Float Quotient: " + floatQuotient);
    }
}

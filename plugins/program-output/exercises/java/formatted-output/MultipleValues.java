/*
@codescope
@title Multiple values in one print statement
@result z
*/
public class MultipleValues {
    public static void main(String[] args) {
        int x = 12;
        int y = 8;
        int z = x + y;

        System.out.print("Value of x is " + x + "\nand value of y is " + y + "\nand their sum is " + z);
    }
}

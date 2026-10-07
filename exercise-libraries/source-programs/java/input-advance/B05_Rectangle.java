/*
@codescope
@title Rectangle Area and Perimeter
@result area
@input target=length value=12 min=1 max=50 step=1
@input target=width value=5 min=1 max=50 step=1
*/
import java.util.Scanner;

public class B05_Rectangle {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int length;
        int width;
        int area;
        int perimeter;

        System.out.print("Enter length and width: ");
        length = input.nextInt();
        width = input.nextInt();
        area = length * width;
        perimeter = 2 * (length + width);
        System.out.println("Area: " + area);
        System.out.println("Perimeter: " + perimeter);
    }
}

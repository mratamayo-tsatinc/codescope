/*
@codescope
@title Reading a Date
@result code
@input target=month value=10 min=1 max=12 step=1
@input target=day value=2 min=1 max=31 step=1
@input target=year value=2026 min=1900 max=2100 step=1
*/
import java.util.Scanner;

public class B07_Date {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int month;
        int day;
        int year;
        int code;

        System.out.print("Enter month day year: ");
        month = input.nextInt();
        day = input.nextInt();
        year = input.nextInt();
        code = year * 10000 + month * 100 + day;
        System.out.println("Month: " + month);
        System.out.println("Day: " + day);
        System.out.println("Year: " + year);
        System.out.println("Sortable code: " + code);
    }
}

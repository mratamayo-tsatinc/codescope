/*
@codescope
@title Assignment before output
@result doubled
*/
public class AssignmentThenOutput {
    public static void main(String[] args) {
        int value = 6;
        int increase = 3;
        int doubled = value * 2;

        value += increase;
        doubled = value * 2;
        System.out.println("Updated value: " + value + "\nDoubled value: " + doubled);
    }
}

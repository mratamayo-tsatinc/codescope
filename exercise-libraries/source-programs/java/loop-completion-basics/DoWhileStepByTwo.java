/*
@codescope
@title Complete a do while step-by-two loop
@seed limit min=5 max=9
*/
public class DoWhileStepByTwo {
    public static void main(String[] args) {
        int number = 1;
        int limit = 7;

        do {
            System.out.println(number);
            number += 2;
        } while (number < limit);

        System.out.println("FINAL NUMBER: " + number);
    }
}

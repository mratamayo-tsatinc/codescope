/*
@codescope
@title Model multiplication by addition
@seed times min=3 max=5
@seed amount min=2 max=4
*/
public class RepeatedAddition {
    public static void main(String[] args) {
        int i = 0;
        int times = 4;
        int amount = 3;
        int total = 0;

        while (i < times) {
            total += amount;
            i++;
        }

        System.out.println("total " + total);
    }
}


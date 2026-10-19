/*
@codescope
@title Follow several for body statements
@seed limit min=2 max=4
*/
public class MultipleStatements {
    public static void main(String[] args) {
        int i;
        int limit = 3;
        int value = 0;
        int total = 0;

        for (i = 1; i <= limit; i++) {
            value = i * 2;
            total += value;
            System.out.println(value);
        }

        System.out.println("total " + total);
    }
}


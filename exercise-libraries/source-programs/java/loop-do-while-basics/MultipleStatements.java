/*
@codescope
@title Follow a multi-statement do body
@seed limit min=2 max=4
*/
public class MultipleStatements {
    public static void main(String[] args) {
        int i = 1;
        int limit = 3;
        int value = 0;
        int total = 0;

        do {
            value = i * 3;
            total += value;
            System.out.println(value);
            i++;
        } while (i <= limit);

        System.out.println("total " + total);
    }
}


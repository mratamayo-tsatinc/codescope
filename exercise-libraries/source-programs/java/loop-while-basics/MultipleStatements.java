/*
@codescope
@title Follow several body statements
@seed limit min=2 max=4
*/
public class MultipleStatements {
    public static void main(String[] args) {
        int i = 1;
        int limit = 3;
        int doubled = 0;
        int total = 0;

        while (i <= limit) {
            System.out.println("calculate doubled value");
            doubled = i * 2;
            total += doubled;
            System.out.println(doubled);
            i++;
            System.out.println("iteration summary ready");
        }

        System.out.println("total " + total);
    }
}


/*
@codescope
@title Add a fixed amount repeatedly
@seed limit min=3 max=5
*/
public class DoubleAccumulator {
    public static void main(String[] args) {
        int i;
        int limit = 4;
        int total = 0;

        for (i = 0; i < limit; i++) {
            System.out.println("add two to total");
            total += 2;
            System.out.println("fixed addition complete");
        }

        System.out.println("total " + total);
    }
}


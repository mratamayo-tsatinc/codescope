/*
@codescope
@title Add values with do while
@seed limit min=3 max=5
*/
public class RunningTotal {
    public static void main(String[] args) {
        int i = 1;
        int limit = 4;
        int total = 0;

        do {
            total += i;
            i++;
        } while (i <= limit);

        System.out.println("total " + total);
    }
}


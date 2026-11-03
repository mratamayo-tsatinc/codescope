/*
@codescope
@title Complete a for step-by-two loop
@seed limit min=6 max=10
*/
public class ForStepByTwo {
    public static void main(String[] args) {
        int i;
        int limit = 8;

        for (i = 0; i < limit; i += 2) {
            System.out.println(i);
        }

        System.out.println("FINAL INDEX: " + i);
    }
}
